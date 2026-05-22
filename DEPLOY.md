# DEPLOY.md — Mini Jira AWS (Kenzy's package)

This document is the runbook for the **hosting layer** of Mini Jira AWS:
a 2-AZ VPC, an Application Load Balancer in public subnets, an Auto Scaling
Group of backend EC2s in private subnets, an S3 + CloudFront frontend, and the
IAM glue that lets the backend talk to DynamoDB / Cognito / S3 / SNS.

The deliverable is a **single CloudFront URL** that serves the React app and
proxies `/api/*` to the ALB.

---

## 1. Prerequisites (owned by other teammates)

You need these values **before** you deploy. Collect them in a scratch pad:

| Value                     | From           | Example                                    |
| ------------------------- | -------------- | ------------------------------------------ |
| `AWS_REGION`              | team agreement | `us-east-1`                                |
| `COGNITO_USER_POOL_ID`    | Judy           | `us-east-1_abc123XYZ`                      |
| `COGNITO_CLIENT_ID`       | Judy           | `7r...`                                    |
| `COGNITO_CLIENT_SECRET`   | Judy (if any)  | `...` *(only if the client has a secret)*  |
| DynamoDB table names      | Judy           | `mini-jira-users`, `-teams`, `-projects`, `-tasks`, `-comments` |
| S3 attachments bucket     | uploads owner  | `mini-jira-attachments-<account>`          |
| SNS topic ARN (optional)  | notifications  | `arn:aws:sns:us-east-1:...:mini-jira-events` |
<<<<<<< HEAD
=======
| Digest email (optional)   | Kenzy digest   | `you@team.edu` — confirms SNS subscription |
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c

You also need, on the machine you deploy from:

- AWS CLI v2 (`aws --version`)
- Node.js 20+ and npm (only for building the frontend locally)
- An IAM user / SSO profile with permission to create VPC, EC2, ALB, ASG,
  IAM roles, CloudFormation stacks, S3 buckets, and CloudFront distributions.

---

## 2. One-time AWS account setup

Done in the **AWS Console or CLI**, not from this repo:

1. **EC2 key pair** *(optional, only for SSH/SSM debugging)* — EC2 → Key Pairs → Create. Save the `.pem`.
2. **Store backend secrets in SSM Parameter Store** under prefix
   `/mini-jira/prod/`. The EC2 boot script reads every parameter under this
   prefix and writes it to `/etc/mini-jira.env`. Create at minimum:

   ```text
   /mini-jira/prod/COGNITO_USER_POOL_ID   (String)
   /mini-jira/prod/COGNITO_CLIENT_ID      (String)
   /mini-jira/prod/COGNITO_CLIENT_SECRET  (SecureString)   # if the client has a secret
   /mini-jira/prod/DYNAMODB_USERS_TABLE   (String)
   /mini-jira/prod/DYNAMODB_TEAMS_TABLE   (String)
   /mini-jira/prod/DYNAMODB_PROJECTS_TABLE(String)
   /mini-jira/prod/DYNAMODB_TASKS_TABLE   (String)
   /mini-jira/prod/DYNAMODB_COMMENTS_TABLE(String)
   /mini-jira/prod/S3_BUCKET_NAME         (String)
   /mini-jira/prod/S3_PUBLIC_BASE_URL     (String)   # optional, CloudFront URL of attachments
   /mini-jira/prod/CORS_ORIGIN            (String)   # fill in AFTER step 3 with the CloudFront URL
   ```

   AWS CLI shortcut:

   ```bash
   aws ssm put-parameter --name /mini-jira/prod/COGNITO_USER_POOL_ID --type String --value us-east-1_xxx
   aws ssm put-parameter --name /mini-jira/prod/COGNITO_CLIENT_SECRET --type SecureString --value 'xxx'
   # ...repeat for every value above.
   ```

3. **(Optional) ACM certificate in `us-east-1`** if you want HTTPS on a custom
   domain. Not required — the template uses the default CloudFront certificate.

---

## 3. Deploy the infrastructure (CloudFormation)

The stack is described in [`infra/cloudformation.yaml`](infra/cloudformation.yaml).

```bash
aws cloudformation deploy \
  --stack-name mini-jira-prod \
  --template-file infra/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      ProjectName=mini-jira \
      EnvName=prod \
      AttachmentsBucketName=mini-jira-attachments-<account> \
      CognitoUserPoolId=us-east-1_xxx \
      SnsTopicArn=arn:aws:sns:us-east-1:<account>:mini-jira-events \
      GitRepoUrl=https://github.com/Judy747/mini-jira-aws.git \
      GitBranch=main
```

When it finishes, grab the outputs:

```bash
aws cloudformation describe-stacks --stack-name mini-jira-prod \
  --query 'Stacks[0].Outputs' --output table
```

Useful outputs:

- `CloudFrontUrl` — **public deliverable URL**
- `AlbDnsName` — ALB DNS, for direct API smoke tests
- `FrontendBucketName` — S3 bucket the frontend deploys to
- `AutoScalingGroupName` — set desired capacity to 0 to stop instances
- `SsmParameterPrefix` — confirm it matches the prefix you populated in step 2

Then **go back to SSM** and set `CORS_ORIGIN` to the `CloudFrontUrl` value.
Tell Judy to add that same URL to the Cognito App Client's
**Allowed callback URLs / Allowed sign-out URLs**.

---

## 4. Deploy the frontend

The frontend build is published to the S3 bucket created by the stack, then
CloudFront is invalidated.

PowerShell (Windows, the way Kenzy works locally):

```powershell
$env:S3_BUCKET           = "mini-jira-prod-frontend-<account>"
$env:CLOUDFRONT_DIST_ID  = "EXXXXXXXXXXXX"
$env:AWS_REGION          = "us-east-1"
$env:VITE_API_URL        = "/api"   # same-origin via CloudFront behavior
./infra/deploy-frontend.ps1
```

Bash (CI / Mac / Linux):

```bash
export S3_BUCKET=mini-jira-prod-frontend-<account>
export CLOUDFRONT_DIST_ID=EXXXXXXXXXXXX
export AWS_REGION=us-east-1
export VITE_API_URL=/api
./infra/deploy-frontend.sh
```

Both scripts: `npm ci` → `npm run build` → `aws s3 sync` (hashed assets with
`max-age=31536000,immutable`, `index.html` with `no-cache`) → CloudFront
invalidation of `/` and `/index.html`.

---

## 5. Deploy the backend

The backend deploys automatically: every EC2 instance the Auto Scaling Group
launches runs `infra/user-data.sh`, which:

1. Installs Node.js 20 and the CloudWatch agent.
2. Clones this repo on `GitBranch` into `/opt/mini-jira` as the `miniapp` user.
3. Runs `npm ci --omit=dev` in `backend/`.
4. Pulls every parameter under `/mini-jira/prod/` from SSM and writes
   `/etc/mini-jira.env`.
5. Starts `mini-jira.service` (systemd unit) which runs `node src/server.js`
   on port `4000` and auto-restarts on crash.

To **roll out new backend code**:

```bash
# Easiest: trigger an instance refresh so the ASG replaces both EC2s.
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name mini-jira-prod-asg \
  --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":120}'
```

The new instances pull the latest commit on `GitBranch` and boot.

---

## 6. Health verification

The backend already exposes `GET /health` returning `{ "ok": true }`.

```bash
# 1. ALB sees 2 healthy targets in 2 different AZs.
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
      --names mini-jira-prod-tg --query 'TargetGroups[0].TargetGroupArn' --output text)

# 2. ALB directly responds 200 on /health.
curl -i http://<AlbDnsName>/health

# 3. CloudFront -> ALB path works (proves /api/* behavior).
curl -i https://<CloudFrontUrl>/api/health

# 4. Frontend loads.
open https://<CloudFrontUrl>     # or just visit it in a browser
```

Acceptance criteria from the assignment, mapped to commands above:

- ✅ **CloudFront URL opens the live site with no extra setup** — step 4.
- ✅ **ALB shows 2 healthy targets in 2 AZs** — `describe-target-health` output
  should list both `PrivateSubnet1` and `PrivateSubnet2` AZs as `healthy`.
- ✅ **API reachable through the same public entry point** —
  `curl https://<CloudFrontUrl>/api/health` returns `{"ok":true}`.

---

## 7. Stop without terminating (required for submission)

> The brief says: *do not terminate after submission.* Stopping the running
> EC2 instances is fine; deleting the CloudFormation stack is **not**.

To stop:

```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name mini-jira-prod-asg \
  --min-size 0 --desired-capacity 0
```

The ALB, target group, VPC, S3 bucket, and CloudFront distribution all remain.
The CloudFront URL will return 5xx from the API until you restart.

To restart:

```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name mini-jira-prod-asg \
  --min-size 2 --desired-capacity 2
```

Wait ~3 minutes for the new instances to register as healthy, then re-check
step 6.

To fully tear everything down (only after the project is graded):

```bash
aws cloudformation delete-stack --stack-name mini-jira-prod
```

This will fail to delete the frontend S3 bucket if it still has objects in it
— empty it first:

```bash
aws s3 rm s3://mini-jira-prod-frontend-<account> --recursive
```

---

## 8. Troubleshooting

| Symptom                                              | Likely cause / fix                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ALB targets stuck `initial` for > 5 min              | EC2 still running user-data. SSH/SSM in and `tail -f /var/log/user-data.log`.       |
| Targets `unhealthy` with `Health checks failed`      | Backend crashed. `journalctl -u mini-jira -n 200` on the instance.                  |
| CloudFront returns 502/504 on `/api/*`               | ALB has no healthy targets, or the SG between ALB and EC2 is wrong.                 |
| Cognito error "SECRET_HASH was not received"        | Set `COGNITO_CLIENT_SECRET` in SSM and roll the ASG.                                |
| CORS errors in the browser                           | `CORS_ORIGIN` in SSM doesn't match the CloudFront URL exactly (scheme + host).      |
| New frontend code not visible                        | CloudFront cached the old `index.html`. The deploy script invalidates it; re-run.   |
| `npm ci` fails on EC2                                | Lockfile out of sync. Re-run locally, commit `package-lock.json`, restart the ASG.  |

Connect to an instance for debugging (no SSH needed thanks to SSM):

```bash
aws ssm start-session --target i-0123456789abcdef0
```

---

<<<<<<< HEAD
## 9. File map
=======
## 9. Daily digest Lambda (EventBridge + SNS)

Separate stack: [`infra/digest-lambda.yaml`](infra/digest-lambda.yaml). Runs daily at **9:00** in `DigestTimezone` (default `UTC`; use e.g. `Africa/Cairo` for local 9 AM).

```powershell
cd backend
.\scripts\package-digest-lambda.ps1
aws s3 cp lambda\digestLambda.zip s3://YOUR-DEPLOY-BUCKET/lambda/digestLambda.zip

aws cloudformation deploy `
  --stack-name mini-jira-digest `
  --template-file infra/digest-lambda.yaml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    ProjectName=mini-jira EnvName=prod `
    TasksTableName=mini-jira-tasks UsersTableName=mini-jira-users `
    DigestHour=9 DigestTimezone=Africa/Cairo `
    DigestNotificationEmail=you@example.com `
    LambdaCodeS3Bucket=YOUR-DEPLOY-BUCKET LambdaCodeS3Key=lambda/digestLambda.zip
```

Confirm the SNS email subscription, then test: `aws lambda invoke --function-name mini-jira-prod-digest out.json`.

**Lambda IAM:** `dynamodb:Scan`/`GetItem` on tasks + users tables; `sns:Publish` on the digest topic.

---

## 10. File map
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c

| Path                              | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `infra/cloudformation.yaml`       | Full stack: VPC, ALB, ASG, IAM, S3, CloudFront.               |
<<<<<<< HEAD
| `infra/user-data.sh`              | Runs on every EC2 boot; installs deps and starts the backend. |
| `infra/deploy-frontend.sh` / `.ps1` | Builds the React app and publishes to S3 + invalidates CF.  |
| `backend/src/server.js`           | Already exposes `GET /health` for the ALB target group.       |
=======
| `infra/digest-lambda.yaml`        | Digest SNS topic, Lambda, EventBridge Scheduler (9 AM).       |
| `infra/user-data.sh`              | Runs on every EC2 boot; installs deps and starts the backend. |
| `infra/deploy-frontend.sh` / `.ps1` | Builds the React app and publishes to S3 + invalidates CF.  |
| `backend/src/server.js`           | Already exposes `GET /health` for the ALB target group.       |
| `backend/lambda/digestLambda/`    | Daily digest: tasks due today → SNS email.                    |
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
