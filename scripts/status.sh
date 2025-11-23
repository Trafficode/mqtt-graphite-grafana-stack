#!/bin/bash
# Check status of all services

echo "Docker Services Status:"
echo "======================="
sudo docker compose ps

echo ""
echo "MQTT Bridge Status:"
echo "==================="
if systemctl list-unit-files | grep -q mqtt-graphite-bridge.service; then
    sudo systemctl status mqtt-graphite-bridge --no-pager -l
else
    echo "MQTT bridge service not installed"
    echo "Run: ./scripts/install-mqtt-bridge.sh"
fi

echo ""
echo "Docker Stats:"
echo "============="
docker stats --no-stream $(docker-compose ps -q)

echo ""
echo "Service URLs:"
echo "============="
echo "Grafana:  http://$(hostname -I | awk '{print $1}'):3000"
echo "Graphite: http://$(hostname -I | awk '{print $1}')"
echo ""
