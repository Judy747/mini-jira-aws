/**
 * Daily digest Lambda — scans tasks due today, groups by assignee, publishes via SNS.
 *
 * Env: SNS_DIGEST_TOPIC_ARN (or TOPIC_ARN), DYNAMODB_TASKS_TABLE, DYNAMODB_USERS_TABLE,
 *      AWS_REGION, DIGEST_TIMEZONE (IANA, e.g. Africa/Cairo, America/New_York)
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TASKS_TABLE = process.env.DYNAMODB_TASKS_TABLE;
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE;
const TOPIC_ARN = process.env.SNS_DIGEST_TOPIC_ARN || process.env.TOPIC_ARN;
const TIMEZONE = process.env.DIGEST_TIMEZONE || 'UTC';

const LEGACY_STATUS_MAP = {
  'To Do': 'TODO',
  'In Progress': 'IN_PROGRESS',
  'In Review': 'IN_REVIEW',
  Done: 'DONE',
};

const STATUS_LABELS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const sns = new SNSClient({ region: REGION });

function normalizeStatus(value) {
  if (!value) return null;
  if (STATUS_LABELS[value]) return value;
  return LEGACY_STATUS_MAP[value] || value;
}

/** YYYY-MM-DD in the given IANA timezone */
function calendarDay(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatDueTime(iso, timeZone) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

async function scanAll(tableName) {
  const items = [];
  let lastKey;
  do {
    const r = await doc.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...(r.Items || []));
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function getUser(userId) {
  if (!USERS_TABLE || !userId) return null;
  try {
    const r = await doc.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
    );
    return r.Item || null;
  } catch {
    return null;
  }
}

function tasksDueToday(tasks, todayKey) {
  return tasks.filter((t) => {
    const st = normalizeStatus(t.status);
    if (st === 'DONE') return false;
    const dueRaw = t.dueDate ?? t.deadline;
    if (!dueRaw) return false;
    return calendarDay(new Date(dueRaw), TIMEZONE) === todayKey;
  });
}

async function groupByAssignee(tasks) {
  const groups = new Map();
  const userCache = new Map();

  for (const task of tasks) {
    const key = task.assigneeId?.trim() || '__unassigned__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__unassigned__') return 1;
    if (b === '__unassigned__') return -1;
    return a.localeCompare(b);
  });

  const sections = [];
  for (const key of sortedKeys) {
    const list = groups.get(key).sort((a, b) =>
      (a.title || '').localeCompare(b.title || '')
    );
    let heading;
    if (key === '__unassigned__') {
      heading = 'Unassigned';
    } else {
      if (!userCache.has(key)) {
        const u = await getUser(key);
        userCache.set(key, u);
      }
      const u = userCache.get(key);
      const name = u?.name || u?.email || key;
      const email = u?.email ? ` (${u.email})` : '';
      heading = `${name}${email}`;
    }
    sections.push({ heading, tasks: list });
  }
  return sections;
}

function buildMessage({ todayKey, sections, totalTasks }) {
  const lines = [
    'Mini Jira AWS — Daily Digest',
    `Date: ${todayKey} (${TIMEZONE})`,
    '',
    `You have ${totalTasks} open task${totalTasks === 1 ? '' : 's'} due today.`,
    '',
  ];

  if (totalTasks === 0) {
    lines.push('No tasks are due today. Enjoy your day!');
    return lines.join('\n');
  }

  for (const { heading, tasks } of sections) {
    lines.push(`--- ${heading} ---`);
    tasks.forEach((t, i) => {
      const status = STATUS_LABELS[normalizeStatus(t.status)] || t.status || '—';
      const due = formatDueTime(t.dueDate ?? t.deadline, TIMEZONE);
      lines.push(`${i + 1}. ${t.title || '(untitled)'} [${status}] — due ${due}`);
      if (t.teamId) lines.push(`   Team: ${t.teamId}`);
    });
    lines.push('');
  }

  lines.push('— Mini Jira daily digest');
  return lines.join('\n');
}

exports.handler = async () => {
  if (!TOPIC_ARN) {
    throw new Error('SNS_DIGEST_TOPIC_ARN or TOPIC_ARN is required');
  }
  if (!TASKS_TABLE) {
    throw new Error('DYNAMODB_TASKS_TABLE is required');
  }

  const todayKey = calendarDay(new Date(), TIMEZONE);
  console.log('[digest] Building digest for', todayKey, 'tz=', TIMEZONE);

  const allTasks = await scanAll(TASKS_TABLE);
  const dueToday = tasksDueToday(allTasks, todayKey);
  const sections = await groupByAssignee(dueToday);
  const message = buildMessage({
    todayKey,
    sections,
    totalTasks: dueToday.length,
  });

  const subject = `Mini Jira Daily Digest — ${todayKey} (${dueToday.length} due today)`;
  await sns.send(
    new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: subject.slice(0, 100),
      Message: message,
    })
  );

  console.log('[digest] Published to SNS', {
    topicArn: TOPIC_ARN,
    dueToday: dueToday.length,
    assigneeGroups: sections.length,
  });

  return {
    ok: true,
    date: todayKey,
    timezone: TIMEZONE,
    tasksDueToday: dueToday.length,
    assigneeGroups: sections.length,
    topicArn: TOPIC_ARN,
    sentAt: new Date().toISOString(),
  };
};
