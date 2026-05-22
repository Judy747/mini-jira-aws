#!/bin/bash
# Rebuild /etc/mini-jira.env from SSM (user-data only does this on first boot).
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
SSM_PREFIX="${SSM_PREFIX:-/mini-jira/prod}"
ENV_FILE="${ENV_FILE:-/etc/mini-jira.env}"

: > "$ENV_FILE"
chmod 600 "$ENV_FILE"
NEXT_TOKEN=""

while :; do
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
  echo "$RESP" | SSM_PREFIX="$SSM_PREFIX" python3 -c '
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
    if re.match(r"^[A-Z_][A-Z0-9_]*$", key):
        print(f"{key}={val}")
' >> "$ENV_FILE"
  NEXT_TOKEN=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("NextToken",""))')
  [ -z "$NEXT_TOKEN" ] && break
done

grep -q '^PORT=' "$ENV_FILE" || echo "PORT=4000" >> "$ENV_FILE"
grep -q '^NODE_ENV=' "$ENV_FILE" || echo "NODE_ENV=production" >> "$ENV_FILE"
grep -q '^AWS_REGION=' "$ENV_FILE" || echo "AWS_REGION=${REGION}" >> "$ENV_FILE"

chown miniapp:miniapp "$ENV_FILE" 2>/dev/null || true

if grep -q '^SNS_TASK_ASSIGNMENT_TOPIC_ARN=' "$ENV_FILE"; then
  echo "[refresh-env] SNS_TASK_ASSIGNMENT_TOPIC_ARN is set"
else
  echo "[refresh-env] WARN: SNS_TASK_ASSIGNMENT_TOPIC_ARN missing — assignment pipeline disabled on API"
fi
