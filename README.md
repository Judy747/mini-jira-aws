# Mini Jira AWS

**Live site:** **<https://d2qic2nqco9xo5.cloudfront.net>**
(Open in any browser — no extra setup required.)

**Architecture diagram:** [`docs/architecture.png`](docs/architecture.png) (AWS standard icons; see `docs/ARCHITECTURE.md` for the component-by-component walkthrough).

Cloud task management (Jira/Trello-style) with a **React + Vite** frontend, **Express** backend, **Amazon DynamoDB**, **Cognito** authentication, and **S3** image uploads. Team isolation for employees is **enforced in the API**, not only in the UI.

## High-availability architecture (one-liner)

Browser → **CloudFront** (S3 frontend at `/*`, ALB at `/api/*`) → **Application Load Balancer** (`/health`) → **Auto Scaling Group** of EC2 (Node/Express) across **2 AZs in private subnets** behind a **NAT** → **DynamoDB** (Users/Teams/Projects/Tasks/Comments/StatusAudit/ActivityLog with GSIs on `teamId` & `assigneeId`) + **S3 originals** (versioned, presigned PUT) → **Lambda image-resize** writes to **S3 resized** → **Cognito** issues JWTs verified per request. Assignments fan out via **SNS → SQS → Lambda worker** → DynamoDB activity log + **CloudWatch** custom metric `TasksAssignedPerTeam`. **EventBridge Scheduler** triggers a daily 9 AM digest Lambda → SNS email. **CloudWatch dashboard + alarm** monitor overdue tasks and EC2 CPU.

## Repository layout

| Path | Description |
|------|-------------|
| `frontend/` | React app (Tailwind, shadcn-style UI, React Router, Axios, drag-and-drop Kanban) |
| `backend/` | Express REST API, Cognito JWT verification, DynamoDB repositories, S3 presign |
| `infra/` | CloudFormation template, EC2 user-data, and frontend S3+CloudFront deploy scripts |
| `DEPLOY.md` | Operator runbook for the AWS hosting stack (VPC, ALB, ASG, CloudFront) |

## Quick start (local)

1. **Backend** — copy `backend/.env.example` to `backend/.env`, fill AWS and table names, then:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend** — default dev setup proxies `/api` to `http://localhost:4000` (see `frontend/vite.config.js`). Optional: set `VITE_API_URL` in `frontend/.env`.

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`, register an **employee** (requires an existing `teamId`), or sign in after an admin provisions users.

## Troubleshooting registration / login

If Cognito returns **`Client ... is configured with secret but SECRET_HASH was not received`**, your app client has a **client secret** but the backend did not send one. Do **either**:

1. Set **`COGNITO_CLIENT_SECRET`** in `backend/.env` to the secret from Cognito (App integration → your app client → show client secret), **or**
2. Create a **new** app client in the same user pool **without** generating a client secret, and put its client ID in **`COGNITO_CLIENT_ID`** (typical for browser-only apps; this server still works if you keep the secret and set env var #1).

The API now returns Cognito’s message in the JSON body (not only “Internal server error”) for most AWS client errors.

## AWS prerequisites

- **Cognito User Pool** with an app client that allows **USER_PASSWORD_AUTH** (and optional app client secret; the API supports `SECRET_HASH` when configured).
- **DynamoDB** tables (names via env vars) — see table designs below.
- **S3 bucket** for attachments; configure **CORS** to allow `PUT` from your web origin, and either public read objects or **CloudFront** (set `S3_PUBLIC_BASE_URL` to the URL returned to clients after upload).
- **IAM** permissions for the backend role/user: DynamoDB CRUD on the tables, `cognito-idp:SignUp`, `InitiateAuth`, `AdminCreateUser`, `AdminGetUser`, `AdminConfirmSignUp` (optional), and S3 `PutObject` for presigned uploads.

## Roles

| Role | Capabilities |
|------|----------------|
| **EMPLOYEE** | Tasks for own `teamId` only; update **status** and **imageUrl**; comments; presigned uploads. |
| **MANAGER** | Create projects/tasks; assign teams; view all tasks; **server-side** `teamId` filter query param. |
| **ADMIN** | Manager capabilities plus `POST /teams` and `POST /users` (Cognito + Dynamo user profile). |

## REST API (summary)

| Area | Methods |
|------|---------|
| Auth | `POST /auth/login`, `POST /auth/register`, `POST /auth/confirm`, `POST /auth/resend-code`, `GET /auth/me` (Bearer) |
| Tasks | `GET /tasks`, `GET /tasks/summary`, `GET /tasks/:id`, `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id` |
| Projects | `GET /projects`, `GET /projects/:id`, `POST /projects`, `PUT /projects/:id`, `DELETE /projects/:id` |
| Comments | `GET /comments/:taskId`, `POST /comments` |
| Audit | `GET /audit/:taskId` — status change history (newest first) |
| Directory | `GET /users` (manager/admin), `GET /teams`, `POST /teams` (admin), `POST /users` (admin) |
| Uploads | `POST /uploads/presign` — returns `{ method: "PUT", uploadUrl, key, publicUrl, thumbnailUrl }` (optional `taskId` for stable S3 key) |

All routes except `/auth/*` and `/health` require a valid **Cognito ID token** (`Authorization: Bearer <idToken>`).

## DynamoDB table designs

### `Users` (`DYNAMODB_USERS_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `userId` | String (Cognito `sub`) | **PK** |
| `email`, `name`, `role`, `teamId`, `createdAt` | String / optional | — |

### `Teams` (`DYNAMODB_TEAMS_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `teamId` | String | **PK** |
| `name`, `createdAt` | String | — |

### `Projects` (`DYNAMODB_PROJECTS_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `projectId` | String | **PK** |
| `name`, `description`, `teamId`, `createdBy`, `createdAt` | String | — |

**GSI `TeamProjectsIndex`:** PK = `teamId`, SK = `projectId` (projectId as range key helps uniqueness per team listing).

### `Tasks` (`DYNAMODB_TASKS_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `taskId` | String | **PK** |
| `title`, `description`, `priority`, `status`, `dueDate`, `assigneeId`, `teamId`, `projectId`, `createdBy`, `imageKey`, `imageUrl`, `thumbnailUrl`, `createdAt`, `updatedAt` | mixed | — |

**Status values:** `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` (legacy `To Do` / `In Progress` labels are normalized on read).

**Priority values:** `LOW`, `MEDIUM`, `HIGH`.

**GSI `teamId-index`:** PK = `teamId`, SK = `taskId` (Query all tasks in a team; optional `FilterExpression` for `projectId` / `status`).

**GSI `AssigneeTasksIndex`:** PK = `assigneeId`, SK = `taskId` (optional “my work” views; sparse if `assigneeId` absent).

### `mini-jira-status-audit` (`DYNAMODB_STATUS_AUDIT_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `taskId` | String | **PK** |
| `auditId` | String (UUID) | **SK** |
| `changedBy`, `fromStatus`, `toStatus`, `changedAt` | String | — |

Written automatically when a task is created (initial status) or when status changes via `PUT /tasks/:id` or Kanban drag-and-drop. Rows are deleted when the task is deleted.

**Provision:** `aws cloudformation deploy --template-file infra/dynamodb-status-audit.yaml --stack-name mini-jira-status-audit --parameter-overrides ProjectName=mini-jira` or `node backend/scripts/create-status-audit-table.js`.

### `Comments` (`DYNAMODB_COMMENTS_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `taskId` | String | **PK** |
| `commentId` | String (UUID) | **SK** |
| `text`, `authorId`, `authorName`, `createdAt` | String | — |

## S3 image pipeline (Marwan)

Dual-bucket uploads (originals + resized thumbnails), presigned browser PUT, and resize Lambda. See **[docs/S3_IMAGE_PIPELINE.md](docs/S3_IMAGE_PIPELINE.md)** for keys, delete behavior, CORS, and AWS setup checklist.

## Task assignment pipeline (SNS + SQS + Lambda)

When a manager assigns a task, the API publishes to SNS; the topic fans out to **email** and **SQS**; the worker Lambda writes **`mini-jira-activity-log`** and publishes **`TasksAssignedPerTeam`** in CloudWatch namespace `MiniJira`.

| Piece | Location |
|-------|----------|
| API publish | `backend/services/assignmentEvents.js` — env `SNS_TASK_ASSIGNMENT_TOPIC_ARN` |
| Trigger | `backend/services/taskService.js` — on create with assignee or assignee change |
| Worker | `backend/lambda/assignmentWorker/` |
| IaC | `infra/assignment-pipeline.yaml`, `infra/dynamodb-activity-log.yaml` |
| Verify in app | `GET /api/activity` (manager) — Dashboard “Assignment events” card |

**Deploy (new stack):**

```bash
# Activity table (skip if mini-jira-activity-log already exists)
aws cloudformation deploy \
  --stack-name mini-jira-activity-log \
  --template-file infra/dynamodb-activity-log.yaml

bash backend/scripts/package-assignment-worker.sh
aws s3 cp backend/lambda/assignmentWorker.zip s3://YOUR-DEPLOY-BUCKET/lambda/assignmentWorker.zip

aws cloudformation deploy \
  --stack-name mini-jira-assignment \
  --template-file infra/assignment-pipeline.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      NotificationEmail=you@example.com \
      LambdaCodeS3Bucket=YOUR-DEPLOY-BUCKET \
      LambdaCodeS3Key=lambda/assignmentWorker.zip
```

Set `SNS_TASK_ASSIGNMENT_TOPIC_ARN` to the stack output `AssignmentTopicArn` (or `arn:aws:sns:...:mini-jira-task-assignments` if you already created the topic).

**Update worker code only (existing AWS resources):**

```bash
bash backend/scripts/package-assignment-worker.sh
aws lambda update-function-code \
  --function-name mini-jira-assignment-worker \
  --zip-file fileb://backend/lambda/assignmentWorker.zip

# Gmail SMTP for dynamic assignee emails (App Password, not regular password)
aws lambda update-function-configuration \
  --function-name mini-jira-assignment-worker \
  --environment "Variables={DYNAMODB_ACTIVITY_LOG_TABLE=mini-jira-activity-log,CLOUDWATCH_NAMESPACE=MiniJira,EMAIL_USER=your@gmail.com,EMAIL_PASS=your-gmail-app-password}"
```

**Lambda environment variables:**

| Variable | Purpose |
|----------|---------|
| `DYNAMODB_ACTIVITY_LOG_TABLE` | Activity log table (default `mini-jira-activity-log`) |
| `CLOUDWATCH_NAMESPACE` | Metric namespace (default `MiniJira`) |
| `EMAIL_USER` | Gmail address used to send mail |
| `EMAIL_PASS` | Gmail **App Password** ([Google Account → Security → App passwords](https://myaccount.google.com/apppasswords)) |

Architecture unchanged: **Backend → SNS → SQS → Lambda** (email is sent inside the worker, not via SNS email subscription).

**Verify:** assign a task as manager → backend `[assignmentEvents] SNS publish succeeded` → Lambda `Saved activity` → CloudWatch metric `TasksAssignedPerTeam`. Optional assignee email: configure Gmail on the worker Lambda (`EMAIL_USER` / `EMAIL_PASS` above) or use an SNS email subscription on the topic.

## Status audit & daily digest (Kenzy)

- **Audit API:** `GET /audit/:taskId` (Bearer token; same access rules as viewing the task).
- **DynamoDB:** Table `mini-jira-status-audit` (PK `taskId`, SK `auditId`). Deploy `infra/dynamodb-status-audit.yaml` or run `node backend/scripts/create-status-audit-table.js`.
- **Env:** `DYNAMODB_STATUS_AUDIT_TABLE=mini-jira-status-audit` (required; matches EC2 IAM `mini-jira-*` pattern).

### Daily digest (EventBridge + Lambda + SNS)

| Piece | Location |
|-------|----------|
| Lambda code | `backend/lambda/digestLambda/` — scans tasks due **today** (in `DIGEST_TIMEZONE`), groups by assignee, publishes one SNS message |
| IaC | `infra/digest-lambda.yaml` — SNS topic, Lambda IAM (tasks + users read, SNS publish), EventBridge **Scheduler** `cron(0 9 * * ? *)` at 9:00 in your timezone |

**Deploy:**

```bash
cd backend/lambda/digestLambda && npm ci --omit=dev
# zip contents (index.js + node_modules) to digestLambda.zip, upload to S3

aws cloudformation deploy \
  --stack-name mini-jira-digest \
  --template-file infra/digest-lambda.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      ProjectName=mini-jira \
      EnvName=prod \
      TasksTableName=mini-jira-tasks \
      UsersTableName=mini-jira-users \
      DigestHour=9 \
      DigestTimezone=Africa/Cairo \
      DigestNotificationEmail=you@example.com \
      LambdaCodeS3Bucket=your-deploy-bucket \
      LambdaCodeS3Key=lambda/digestLambda.zip
```

**Lambda env:** `SNS_DIGEST_TOPIC_ARN`, `DYNAMODB_TASKS_TABLE`, `DYNAMODB_USERS_TABLE`, `DIGEST_TIMEZONE` (set by the stack). Confirm the SNS email subscription in your inbox after deploy.

## Drag and drop

The Kanban board uses [**@hello-pangea/dnd**](https://github.com/hello-pangea/dnd), the maintained fork of **react-beautiful-dnd**, compatible with modern React (including React 19).

## License

ISC (default; adjust as needed).
