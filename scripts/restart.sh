#!/bin/bash
# Restart the MQTT-Graphite-Grafana stack

set -e

echo "Restarting MQTT-Graphite-Grafana stack..."

# Restart MQTT bridge if installed
if systemctl list-unit-files | grep -q mqtt-graphite-bridge.service; then
    echo "Restarting MQTT bridge service..."
    sudo systemctl restart mqtt-graphite-bridge
fi

echo "Restarting Docker services..."
sudo docker compose restart

echo ""
echo "Stack restarted successfully!"
echo ""
echo "Check status with: sudo docker compose ps"
echo "                   sudo systemctl status mqtt-graphite-bridge"
echo "View logs with:    sudo docker compose logs -f"
echo "                   journalctl -u mqtt-graphite-bridge -f"
echo ""
