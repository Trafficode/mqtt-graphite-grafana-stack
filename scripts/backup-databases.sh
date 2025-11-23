#!/bin/bash
#
# MQTT-Graphite-Grafana Stack - Database Backup Script
# Copyright (C) 2025 Trafficode
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

# Load configuration
if [ ! -f "$WORKSPACE_DIR/config.json" ]; then
    echo "Error: config.json not found!"
    exit 1
fi

# Parse paths from config.json
GRAPHITE_PATH=$(python3 -c "import json; print(json.load(open('$WORKSPACE_DIR/config.json'))['database']['graphite_path'])")
GRAFANA_PATH=$(python3 -c "import json; print(json.load(open('$WORKSPACE_DIR/config.json'))['database']['grafana_path'])")
BACKUP_DIR="/mnt/nvme/monitoring-data-backup"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/monitoring-backup-$TIMESTAMP.tar.gz"

echo "=== Monitoring Database Backup Started at $(date) ==="
echo "Backup file: $BACKUP_FILE"

# Stop services
echo "Stopping services..."
cd "$WORKSPACE_DIR"

# Stop MQTT bridge if running
if systemctl is-active --quiet mqtt-graphite-bridge 2>/dev/null; then
    echo "  Stopping MQTT bridge..."
    sudo systemctl stop mqtt-graphite-bridge
fi

# Stop Docker containers
echo "  Stopping Docker containers..."
sudo docker compose down

# Wait for services to fully stop
sleep 5

# Create compressed backup
echo "Creating backup archive..."
sudo tar -czf "$BACKUP_FILE" \
    -C "$(dirname "$GRAPHITE_PATH")" "$(basename "$GRAPHITE_PATH")" \
    -C "$(dirname "$GRAFANA_PATH")" "$(basename "$GRAFANA_PATH")" \
    2>/dev/null || {
        echo "Warning: Some files may have been skipped"
    }

# Set proper permissions (allow read access)
sudo chmod 644 "$BACKUP_FILE"

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_SIZE"

# Start services
echo "Starting services..."

# Start Docker containers
echo "  Starting Docker containers..."
sudo docker compose up -d

# Start MQTT bridge
echo "  Starting MQTT bridge..."
sudo systemctl start mqtt-graphite-bridge

# Wait for services to start
sleep 5

# Verify services are running
DOCKER_RUNNING=$(sudo docker compose ps --services --filter "status=running" | wc -l)
if [ "$DOCKER_RUNNING" -ge 2 ]; then
    echo "✓ Services restarted successfully (Docker: $DOCKER_RUNNING containers, MQTT bridge: started)"
else
    echo "⚠ Warning: Some Docker containers may not have started"
    sudo docker compose ps
fi

# Cleanup old backups (keep last 30 days)
echo "Cleaning up old backups (keeping last 30 days)..."
find "$BACKUP_DIR" -name "monitoring-backup-*.tar.gz" -type f -mtime +30 -delete 2>/dev/null || true

# List recent backups
echo ""
echo "Recent backups:"
ls -lh "$BACKUP_DIR"/monitoring-backup-*.tar.gz 2>/dev/null | tail -5 || echo "No backups found"

echo ""
echo "=== Backup Completed Successfully at $(date) ==="
