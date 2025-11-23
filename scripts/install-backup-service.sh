#!/bin/bash
#
# MQTT-Graphite-Grafana Stack - Install Backup Service
# Copyright (C) 2025 Trafficode
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Installing Monitoring Backup Service ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Make backup script executable
echo "Setting permissions on backup script..."
chmod +x "$WORKSPACE_DIR/scripts/backup-databases.sh"

# Copy systemd service and timer files
echo "Installing systemd service and timer..."
cp "$WORKSPACE_DIR/systemd/monitoring-backup.service" /etc/systemd/system/
cp "$WORKSPACE_DIR/systemd/monitoring-backup.timer" /etc/systemd/system/

# Reload systemd daemon
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable timer to start at boot
echo "Enabling backup timer..."
systemctl enable monitoring-backup.timer

# Start timer immediately
echo "Starting backup timer..."
systemctl start monitoring-backup.timer

# Show timer status
echo ""
echo "=== Backup Timer Status ==="
systemctl status monitoring-backup.timer --no-pager

echo ""
echo "=== Next Scheduled Backup ==="
systemctl list-timers monitoring-backup.timer --no-pager

echo ""
echo "✓ Backup service installed successfully!"
echo ""
echo "The backup will run daily at 2:00 AM and save to /mnt/nvme/monitoring-data-backup"
echo ""
echo "Useful commands:"
echo "  Check timer status:      systemctl status monitoring-backup.timer"
echo "  View backup schedule:    systemctl list-timers monitoring-backup.timer"
echo "  Run backup manually:     sudo systemctl start monitoring-backup.service"
echo "  View backup logs:        journalctl -u monitoring-backup.service"
echo "  Test backup script:      sudo $WORKSPACE_DIR/scripts/backup-databases.sh"
