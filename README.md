# Mini Jira AWS

Cloud task management (Jira/Trello-style) with a **React + Vite** frontend, **Express** backend, **Amazon DynamoDB**, **Cognito** authentication, and **S3** image uploads. Team isolation for employees is **enforced in the API**, not only in the UI.

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
| Uploads | `POST /uploads/presign` — returns `{ uploadUrl, key, publicUrl }` |

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
| `title`, `description`, `priority`, `status`, `dueDate`, `assigneeId`, `teamId`, `projectId`, `createdBy`, `imageUrl`, `createdAt`, `updatedAt` | mixed | — |

**Status values:** `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` (legacy `To Do` / `In Progress` labels are normalized on read).

**Priority values:** `LOW`, `MEDIUM`, `HIGH`.

**GSI `teamId-index`:** PK = `teamId`, SK = `taskId` (Query all tasks in a team; optional `FilterExpression` for `projectId` / `status`).

**GSI `AssigneeTasksIndex`:** PK = `assigneeId`, SK = `taskId` (optional “my work” views; sparse if `assigneeId` absent).

### `StatusAudit` (`DYNAMODB_STATUS_AUDIT_TABLE`, default table name `StatusAudit`)

| Attribute | Type | Key |
|-----------|------|-----|
| `taskId` | String | **PK** |
| `auditId` | String (UUID) | **SK** |
| `changedBy`, `fromStatus`, `toStatus`, `changedAt` | String | — |

Written automatically when a task status changes via `PUT /tasks/:id` or Kanban drag-and-drop.

### `Comments` (`DYNAMODB_COMMENTS_TABLE`)

| Attribute | Type | Key |
|-----------|------|-----|
| `taskId` | String | **PK** |
| `commentId` | String (UUID) | **SK** |
| `text`, `authorId`, `authorName`, `createdAt` | String | — |

## Status audit & daily digest (Kenzy)

- **Audit API:** `GET /audit/:taskId` (Bearer token; same access rules as viewing the task).
- **DynamoDB:** Create table `StatusAudit` with PK `taskId`, SK `auditId` (on-demand billing is fine for free tier).
- **Env:** `DYNAMODB_STATUS_AUDIT_TABLE=StatusAudit` (optional; this is the default).
- **Digest Lambda:** `backend/lambda/digestLambda.js` — deploy as a Lambda, set `TOPIC_ARN` to an SNS topic with email subscription, trigger daily at 9 AM with EventBridge rule `cron(0 9 * * ? *)`.

## Drag and drop

The Kanban board uses [**@hello-pangea/dnd**](https://github.com/hello-pangea/dnd), the maintained fork of **react-beautiful-dnd**, compatible with modern React (including React 19).

## License

ISC (default; adjust as needed).
