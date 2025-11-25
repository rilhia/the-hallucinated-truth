#!/bin/bash
set -e

echo "---- BOOTSTRAP START ----"

# Clone Temporal repo if missing
if [ ! -d /workspace/temporal/.git ]; then
  echo "Cloning Temporal docker-compose repo..."
  git clone --depth 1 "$TEMPORAL_REPO" /workspace/temporal
else
  echo "Temporal repo already present. Skipping clone."
fi

echo "Starting Temporal..."
docker compose -f /workspace/temporal/docker-compose.yml up -d

echo "Starting Game stack..."
docker compose -f /workspace/game/docker-compose.yml up -d

echo "---- BOOTSTRAP COMPLETE ----"
