#!/bin/bash
# Stop the MQTT-Graphite-Grafana stack

set -e

echo "Stopping MQTT-Graphite-Grafana stack..."

# Stop MQTT bridge if running
if systemctl is-active --quiet mqtt-graphite-bridge 2>/dev/null; then
    echo "Stopping MQTT bridge service..."
    sudo systemctl stop mqtt-graphite-bridge
fi

echo "Stopping Docker services..."
sudo docker compose down

echo "Stack stopped successfully!"
echo ""
echo "To remove all data, run: ./scripts/cleanup.sh"
echo ""
