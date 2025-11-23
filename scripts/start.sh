#!/bin/bash
# Start the MQTT-Graphite-Grafana stack

set -e

echo "Starting MQTT-Graphite-Grafana stack..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

# Check if config.json exists
if [ ! -f config.json ]; then
    echo "Error: config.json not found!"
    exit 1
fi

# Verify database directories exist
GRAPHITE_PATH=$(grep -o '"graphite_path":[^,]*' config.json | grep -o '"/[^"]*"' | tr -d '"')
GRAFANA_PATH=$(grep -o '"grafana_path":[^,]*' config.json | grep -o '"/[^"]*"' | tr -d '"')

if [ ! -d "$GRAPHITE_PATH" ]; then
    echo "Error: Graphite database directory does not exist: $GRAPHITE_PATH"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

if [ ! -d "$GRAFANA_PATH" ]; then
    echo "Error: Grafana database directory does not exist: $GRAFANA_PATH"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

# Start Docker services
echo "Starting Docker services (Graphite, Grafana)..."
sudo docker compose up -d

# Start MQTT bridge if installed
if systemctl list-unit-files | grep -q mqtt-graphite-bridge.service; then
    echo ""
    echo "Starting MQTT bridge service..."
    sudo systemctl start mqtt-graphite-bridge
fi

echo ""
echo "Stack started successfully!"
echo ""
echo "Services:"
echo "  - Grafana:  http://localhost:8041 (admin/admin)"
echo "  - Graphite: http://localhost:8040"
if systemctl list-unit-files | grep -q mqtt-graphite-bridge.service; then
    echo "  - MQTT Bridge: systemd service"
fi
echo ""
echo "Check status with: sudo docker compose ps"
echo "                   sudo systemctl status mqtt-graphite-bridge"
echo "View logs with:    sudo docker compose logs -f"
echo "                   journalctl -u mqtt-graphite-bridge -f"
echo "Stop with:         ./scripts/stop.sh"
echo ""
