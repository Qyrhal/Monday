#!/usr/bin/env bash
set -e

# NOTE: This is fine for now, but would like a better one later -middy, possibly an argo file later to deploy onto the homelab

echo "Starting Monday..."

# Backend
cd "$(dirname "$0")"
uv venv -q 2>/dev/null || true
uv pip install -r backend/requirements.txt -q
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Frontend
cd frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
