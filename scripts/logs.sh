#!/bin/bash
# View logs from all services or a specific service

SERVICE=${1:-}

if [ "$SERVICE" = "mqtt-bridge" ] || [ "$SERVICE" = "bridge" ]; then
    echo "Viewing MQTT bridge logs (Ctrl+C to exit)..."
    journalctl -u mqtt-graphite-bridge -f
elif [ -z "$SERVICE" ]; then
    echo "Viewing logs from all Docker services (Ctrl+C to exit)..."
    echo "For MQTT bridge logs, use: ./scripts/logs.sh mqtt-bridge"
    sudo docker compose logs -f
else
    echo "Viewing logs from $SERVICE (Ctrl+C to exit)..."
    sudo docker compose logs -f "$SERVICE"
fi
