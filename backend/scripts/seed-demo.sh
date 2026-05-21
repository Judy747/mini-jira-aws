#!/bin/bash
# Demo scenario seeding script for Mini Jira AWS
# This script uses curl to call the backend API endpoints to create demo users, teams, and tasks.
# Make sure the backend is running and accessible at the API URL below.

API_URL="http://localhost:4000/api"

# 1. Create Teams
echo "Creating teams..."
curl -s -X POST "$API_URL/teams" -H "Content-Type: application/json" -d '{"teamId":"frontend","name":"Frontend Team"}'
echo
curl -s -X POST "$API_URL/teams" -H "Content-Type: application/json" -d '{"teamId":"backend","name":"Backend Team"}'
echo

# 2. Create Users
echo "Creating users..."
curl -s -X POST "$API_URL/users" -H "Content-Type: application/json" -d '{"userId":"ali","name":"Ali","email":"ali@example.com","role":"MANAGER"}'
echo
curl -s -X POST "$API_URL/users" -H "Content-Type: application/json" -d '{"userId":"sara","name":"Sara","email":"sara@example.com","role":"EMPLOYEE","teamId":"frontend"}'
echo
curl -s -X POST "$API_URL/users" -H "Content-Type: application/json" -d '{"userId":"omar","name":"Omar","email":"omar@example.com","role":"EMPLOYEE","teamId":"backend"}'
echo

# 3. Create Tasks
echo "Creating tasks..."
curl -s -X POST "$API_URL/tasks" -H "Content-Type: application/json" -d '{"taskId":"taskA","title":"Task A","teamId":"frontend","assigneeId":"sara","status":"TODO"}'
echo
curl -s -X POST "$API_URL/tasks" -H "Content-Type: application/json" -d '{"taskId":"taskB","title":"Task B","teamId":"backend","assigneeId":"omar","status":"TODO"}'
echo

echo "Demo data seeded."
