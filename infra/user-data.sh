#!/bin/bash
# EC2 user-data bootstrap for the Mini Jira backend.
# Runs as root on first boot of every instance in the Auto Scaling Group.
# Designed for Amazon Linux 2023. Logs go to /var/log/user-data.log and CloudWatch.
#
# Expected environment (set by the Launch Template or replaced before upload):
#   REGION            AWS region (e.g. us-east-1)
#   GIT_REPO_URL      HTTPS URL of this repository
#   GIT_BRANCH        Branch to deploy (e.g. main)
#   SSM_PREFIX        Parameter Store prefix that holds the backend env (e.g. /mini-jira/prod)
#
# All app secrets live in SSM Parameter Store under $SSM_PREFIX/<KEY>. The instance
# profile must grant ssm:GetParametersByPath on that prefix.

set -euo pipefail
exec > >(tee -a /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

REGION="${REGION:-us-east-1}"
GIT_REPO_URL="${GIT_REPO_URL:-https://github.com/Judy747/mini-jira-aws.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SSM_PREFIX="${SSM_PREFIX:-/mini-jira/prod}"
APP_DIR="/opt/mini-jira"
APP_USER="miniapp"
APP_PORT="${APP_PORT:-4000}"

echo "[user-data] starting at $(date -u) region=$REGION branch=$GIT_BRANCH"

dnf -y update
dnf -y install git tar gzip awscli amazon-cloudwatch-agent

# Node.js 20.x (NodeSource RPM).
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf -y install nodejs

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /sbin/nologin "$APP_USER"

mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# Clone (or refresh) the repo as the app user.
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --all --prune
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$GIT_BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$GIT_BRANCH"
else
  sudo -u "$APP_USER" git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO_URL" "$APP_DIR"
fi

# Install backend deps (production only).
sudo -u "$APP_USER" --preserve-env=HOME bash -lc "cd '$APP_DIR/backend' && npm ci --omit=dev"

# Pull every parameter under $SSM_PREFIX into /etc/mini-jira.env as KEY=VALUE pairs.
ENV_FILE="/etc/mini-jira.env"
: > "$ENV_FILE"
chmod 600 "$ENV_FILE"
NEXT_TOKEN=""
while : ; do
  if [ -z "$NEXT_TOKEN" ]; then
    RESP=$(aws ssm get-parameters-by-path \
      --region "$REGION" \
      --path "$SSM_PREFIX" \
      --with-decryption \
      --recursive)
  else
    RESP=$(aws ssm get-parameters-by-path \
      --region "$REGION" \
      --path "$SSM_PREFIX" \
      --with-decryption \
      --recursive \
      --starting-token "$NEXT_TOKEN")
  fi
  echo "$RESP" | python3 -c '
import json, sys, os, re
prefix = os.environ["SSM_PREFIX"].rstrip("/") + "/"
data = json.load(sys.stdin)
for p in data.get("Parameters", []):
    name = p["Name"]
    if name.startswith(prefix):
        key = name[len(prefix):].replace("/", "_").upper()
    else:
        key = name.rsplit("/", 1)[-1].upper()
    val = p["Value"].replace("\n", "\\n")
    if not re.match(r"^[A-Z_][A-Z0-9_]*$", key):
        continue
    print(f"{key}={val}")
' >> "$ENV_FILE"
  NEXT_TOKEN=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("NextToken",""))')
  [ -z "$NEXT_TOKEN" ] && break
done

# Sensible defaults if SSM did not provide them.
grep -q '^PORT=' "$ENV_FILE" || echo "PORT=${APP_PORT}" >> "$ENV_FILE"
grep -q '^NODE_ENV=' "$ENV_FILE" || echo "NODE_ENV=production" >> "$ENV_FILE"
grep -q '^AWS_REGION=' "$ENV_FILE" || echo "AWS_REGION=${REGION}" >> "$ENV_FILE"

chown "$APP_USER":"$APP_USER" "$ENV_FILE"

# systemd service so the backend restarts on crash and on instance reboot.
cat >/etc/systemd/system/mini-jira.service <<UNIT
[Unit]
Description=Mini Jira AWS backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now mini-jira.service

# CloudWatch agent: ship journald + user-data log.
cat >/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'CWA'
{
  "agent": { "metrics_collection_interval": 60, "run_as_user": "root" },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "/mini-jira/user-data",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  },
  "metrics": {
    "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
    "metrics_collected": {
      "mem": { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["used_percent"], "resources": ["/"] }
    }
  }
}
CWA

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

echo "[user-data] done at $(date -u)"
