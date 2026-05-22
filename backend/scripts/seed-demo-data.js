/**
 * Additive demo data for Mini Jira — never deletes or overwrites existing rows.
 * Safe to re-run: skips teams/projects/tasks that were already seeded (seedTag).
 *
 * Usage (from backend/):
 *   node scripts/seed-demo-data.js
 *   node scripts/seed-demo-data.js --dry-run
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../services/dynamoClient');
const { loadEnv } = require('../config/env');
const teamRepo = require('../services/teamRepository');
const userRepo = require('../services/userRepository');
const projectRepo = require('../services/projectRepository');
const taskRepo = require('../services/taskRepository');
const commentRepo = require('../services/commentRepository');
const auditRepo = require('../services/auditRepository');

const SEED_TAG = 'demo-seed-v1';
const DRY_RUN = process.argv.includes('--dry-run');

const stats = { teams: 0, projects: 0, tasks: 0, comments: 0, audits: 0, skipped: 0 };

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function scanAllTasks() {
  const table = loadEnv().dynamo.tasks;
  const items = [];
  let lastKey;
  do {
    const r = await docClient.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey })
    );
    items.push(...(r.Items || []));
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function log(msg) {
  console.log(DRY_RUN ? `[dry-run] ${msg}` : msg);
}

async function ensureTeam(teams, { teamId, name }) {
  const existing = teams.find((t) => t.teamId === teamId || t.name === name);
  if (existing) return existing;
  const item = { teamId, name, createdAt: new Date().toISOString(), seedTag: SEED_TAG };
  log(`+ team: ${name}`);
  if (!DRY_RUN) await teamRepo.createTeam(item);
  stats.teams += 1;
  teams.push(item);
  return item;
}

async function ensureProject(projects, { teamId, name, description, createdBy }) {
  const existing = projects.find((p) => p.teamId === teamId && p.name === name);
  if (existing) return existing;
  const item = {
    projectId: uuidv4(),
    teamId,
    name,
    description: description || '',
    createdBy,
    createdAt: new Date().toISOString(),
    seedTag: SEED_TAG,
  };
  log(`+ project: ${name} (${teamId})`);
  if (!DRY_RUN) await projectRepo.putProject(item);
  stats.projects += 1;
  projects.push(item);
  return item;
}

function taskExists(tasks, { projectId, title }) {
  return tasks.some(
    (t) => t.projectId === projectId && t.title === title && (t.seedTag === SEED_TAG || t.title === title)
  );
}

async function ensureTask(tasks, users, spec) {
  if (taskExists(tasks, spec)) {
    stats.skipped += 1;
    return null;
  }
  const now = new Date().toISOString();
  const item = {
    taskId: uuidv4(),
    title: spec.title,
    description: spec.description || '',
    priority: spec.priority || 'MEDIUM',
    status: spec.status || 'TODO',
    teamId: spec.teamId,
    projectId: spec.projectId,
    createdBy: spec.createdBy,
    createdAt: now,
    updatedAt: now,
    seedTag: SEED_TAG,
  };
  if (spec.dueDate) item.dueDate = spec.dueDate;
  if (spec.assigneeId) item.assigneeId = spec.assigneeId;
  log(`+ task: ${spec.title} [${spec.status}]`);
  if (!DRY_RUN) {
    await taskRepo.putTask(item);
    if (spec.comments?.length) {
      for (const c of spec.comments) {
        const comment = {
          taskId: item.taskId,
          commentId: uuidv4(),
          text: c.text,
          authorId: c.authorId,
          authorName: c.authorName,
          createdAt: new Date().toISOString(),
          seedTag: SEED_TAG,
        };
        await commentRepo.createComment(comment);
        stats.comments += 1;
      }
    }
    if (spec.auditTrail?.length) {
      for (const step of spec.auditTrail) {
        await auditRepo.createEntry({
          taskId: item.taskId,
          auditId: uuidv4(),
          changedBy: step.changedBy,
          fromStatus: step.fromStatus,
          toStatus: step.toStatus,
          changedAt: step.changedAt || new Date().toISOString(),
        });
        stats.audits += 1;
      }
    }
  } else {
    stats.comments += spec.comments?.length || 0;
    stats.audits += spec.auditTrail?.length || 0;
  }
  stats.tasks += 1;
  tasks.push(item);
  return item;
}

function employeesOnTeam(users, teamId) {
  return users.filter((u) => u.role === 'EMPLOYEE' && u.teamId === teamId);
}

function pickAssignee(users, teamId, index = 0, fallbackUserId) {
  const emps = employeesOnTeam(users, teamId);
  if (emps.length) return emps[index % emps.length].userId;
  return fallbackUserId || null;
}

async function main() {
  const [teams, users, projects, tasks] = await Promise.all([
    teamRepo.listTeams(),
    userRepo.listUsers(),
    projectRepo.listAllProjects(),
    scanAllTasks(),
  ]);

  const manager =
    users.find((u) => u.role === 'MANAGER') ||
    users.find((u) => u.role === 'ADMIN') ||
    users[0];
  if (!manager) {
    console.error('No users in database — create at least one manager first.');
    process.exit(1);
  }
  const createdBy = manager.userId;

  log(`Using creator: ${manager.name || manager.email} (${manager.role})`);
  log(`Existing: ${teams.length} teams, ${projects.length} projects, ${tasks.length} tasks`);

  // Optional fourth team for richer admin / filter UI
  await ensureTeam(teams, { teamId: 'product', name: 'Product & Design' });

  const teamById = Object.fromEntries(teams.map((t) => [t.teamId, t]));

  const newProjects = [
    {
      teamId: 'frontend',
      name: 'UX Improvements',
      description: 'Polish flows, empty states, and responsive layout across the app.',
    },
    {
      teamId: 'backend',
      name: 'API & Integrations',
      description: 'REST endpoints, auth middleware, and DynamoDB access patterns.',
    },
    {
      teamId: 'devops',
      name: 'Release Engineering',
      description: 'Deployments, observability, and infrastructure automation.',
    },
    {
      teamId: 'product',
      name: 'Discovery & Roadmap',
      description: 'User research, specs, and quarterly planning artifacts.',
    },
  ];

  for (const p of newProjects) {
    if (teamById[p.teamId]) {
      await ensureProject(projects, { ...p, createdBy });
    }
  }

  // Also seed into existing named projects for fuller Kanban columns
  const projectByName = (teamId, name) =>
    projects.find((p) => p.teamId === teamId && p.name === name);

  const frontendMain = projectByName('frontend', 'Frontend Website');
  const backendMain = projectByName('backend', 'Backend Project');
  const devopsMain = projectByName('devops', 'DevOps Project');
  const uxProject = projectByName('frontend', 'UX Improvements');
  const apiProject = projectByName('backend', 'API & Integrations');
  const releaseProject = projectByName('devops', 'Release Engineering');
  const discoveryProject = projectByName('product', 'Discovery & Roadmap');

  const taskSpecs = [];

  const add = (project, teamId, spec) => {
    if (!project) return;
    taskSpecs.push({
      ...spec,
      teamId,
      projectId: project.projectId,
      createdBy,
      assigneeId:
        spec.assigneeId ?? pickAssignee(users, teamId, taskSpecs.length, createdBy),
    });
  };

  add(frontendMain, 'frontend', {
    title: 'Implement responsive sidebar navigation',
    description: 'Collapse on mobile, persist open state on desktop, keyboard accessible.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: daysFromNow(5),
    comments: [
      {
        text: 'Mockups approved — starting with the collapsed breakpoint first.',
        authorId: createdBy,
        authorName: manager.name || 'Manager',
      },
    ],
    auditTrail: [
      { changedBy: createdBy, fromStatus: null, toStatus: 'TODO' },
      { changedBy: createdBy, fromStatus: 'TODO', toStatus: 'IN_PROGRESS' },
    ],
  });

  add(frontendMain, 'frontend', {
    title: 'Add loading skeletons to dashboard widgets',
    description: 'Match design system spacing; avoid layout shift when data arrives.',
    status: 'IN_REVIEW',
    priority: 'MEDIUM',
    dueDate: daysFromNow(2),
  });

  add(frontendMain, 'frontend', {
    title: 'Polish Kanban card hover and drag affordances',
    description: 'Subtle elevation, focus ring, and drop-zone highlight per column.',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: daysFromNow(10),
  });

  add(uxProject, 'frontend', {
    title: 'Audit empty states across all list views',
    description: 'Consistent illustration, headline, and primary CTA per page.',
    status: 'TODO',
    priority: 'LOW',
    dueDate: daysFromNow(14),
  });

  add(uxProject, 'frontend', {
    title: 'Define toast notification copy guidelines',
    description: 'Success vs error tone, max length, and when to use action buttons.',
    status: 'IN_PROGRESS',
    priority: 'LOW',
    dueDate: daysFromNow(7),
  });

  add(backendMain, 'backend', {
    title: 'Enrich task API with team and assignee display names',
    description: 'Batch-resolve IDs in list/detail responses so the UI never shows UUIDs.',
    status: 'DONE',
    priority: 'HIGH',
    dueDate: daysFromNow(-3),
    auditTrail: [
      { changedBy: createdBy, fromStatus: null, toStatus: 'TODO' },
      { changedBy: createdBy, fromStatus: 'TODO', toStatus: 'IN_PROGRESS' },
      { changedBy: createdBy, fromStatus: 'IN_PROGRESS', toStatus: 'IN_REVIEW' },
      { changedBy: createdBy, fromStatus: 'IN_REVIEW', toStatus: 'DONE' },
    ],
  });

  add(backendMain, 'backend', {
    title: 'Harden RBAC checks on project mutations',
    description: 'Managers only; employees cannot change teamId on existing projects.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: daysFromNow(4),
  });

  add(apiProject, 'backend', {
    title: 'Document OpenAPI-style route matrix in README',
    description: 'Auth requirements, roles, and sample payloads for graders.',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: daysFromNow(12),
  });

  add(apiProject, 'backend', {
    title: 'Add pagination helper for large task scans',
    description: 'Optional limit/lastKey for manager dashboards in busy teams.',
    status: 'IN_REVIEW',
    priority: 'LOW',
    dueDate: daysFromNow(6),
  });

  add(devopsMain, 'devops', {
    title: 'Create CloudWatch dashboard with four widgets',
    description: 'ALB requests, target health, Lambda errors, custom TasksCompleted metric.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: daysFromNow(3),
    comments: [
      {
        text: 'Widget layout draft shared in team channel — feedback by EOD.',
        authorId: pickAssignee(users, 'devops', 0) || createdBy,
        authorName: 'DevOps',
      },
    ],
  });

  add(devopsMain, 'devops', {
    title: 'Wire SNS alarm for unhealthy target count',
    description: 'Alarm → SNS topic → email subscription for on-call visibility.',
    status: 'TODO',
    priority: 'HIGH',
    dueDate: daysFromNow(8),
  });

  add(releaseProject, 'devops', {
    title: 'Validate blue/green style deploy via SSM Run Command',
    description: 'Rolling npm install on ASG instances; verify health checks pass.',
    status: 'IN_REVIEW',
    priority: 'MEDIUM',
    dueDate: daysFromNow(1),
  });

  add(releaseProject, 'devops', {
    title: 'Fix S3 CORS for CloudFront attachment uploads',
    description: 'Allow PUT/GET from distribution origin; verify preflight in browser.',
    status: 'DONE',
    priority: 'HIGH',
    dueDate: daysFromNow(-1),
  });

  add(discoveryProject, 'product', {
    title: 'Interview three power users on Kanban workflow',
    description: '30-minute sessions; synthesize pain points into backlog items.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    dueDate: daysFromNow(9),
  });

  add(discoveryProject, 'product', {
    title: 'Draft Q3 roadmap one-pager',
    description: 'Themes: observability, manager analytics, mobile-friendly board.',
    status: 'TODO',
    priority: 'LOW',
    dueDate: daysFromNow(21),
  });

  add(discoveryProject, 'product', {
    title: 'Competitive scan: Jira / Linear / Asana',
    description: 'Table of differentiators relevant to our course rubric.',
    status: 'DONE',
    priority: 'LOW',
    dueDate: daysFromNow(-5),
  });

  for (const spec of taskSpecs) {
    await ensureTask(tasks, users, spec);
  }

  console.log('\n--- Seed summary ---');
  console.log(`Teams added:     ${stats.teams}`);
  console.log(`Projects added:  ${stats.projects}`);
  console.log(`Tasks added:     ${stats.tasks}`);
  console.log(`Comments added:  ${stats.comments}`);
  console.log(`Audit rows:      ${stats.audits}`);
  console.log(`Skipped (exist): ${stats.skipped}`);
  if (DRY_RUN) console.log('\nRe-run without --dry-run to write to DynamoDB.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
