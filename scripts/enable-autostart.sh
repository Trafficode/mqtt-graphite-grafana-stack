#!/bin/bash
# Enable auto-start on system boot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Enable Auto-Start on Boot"
echo "=========================================="
echo ""

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Get current user
CURRENT_USER=$(whoami)

echo "Project directory: $PROJECT_DIR"
echo "Running as user: $CURRENT_USER"
echo ""

# Enable Docker to start on boot
echo -e "${YELLOW}Enabling Docker service...${NC}"
sudo systemctl enable docker
echo -e "${GREEN}Docker service enabled${NC}"

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/mqtt-graphite-grafana.service"

echo ""
echo -e "${YELLOW}Creating systemd service...${NC}"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=MQTT-Graphite-Grafana Monitoring Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=$CURRENT_USER
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}Service file created: $SERVICE_FILE${NC}"

# Reload systemd
echo ""
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload
echo -e "${GREEN}Systemd reloaded${NC}"

# Enable the service
echo ""
echo -e "${YELLOW}Enabling mqtt-graphite-grafana service...${NC}"
sudo systemctl enable mqtt-graphite-grafana.service
echo -e "${GREEN}Service enabled${NC}"

# Enable MQTT bridge service if installed
if systemctl list-unit-files | grep -q mqtt-graphite-bridge.service; then
    echo ""
    echo -e "${YELLOW}Enabling MQTT bridge service...${NC}"
    sudo systemctl enable mqtt-graphite-bridge.service
    echo -e "${GREEN}MQTT bridge service enabled${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}Auto-start configured successfully!${NC}"
echo "=========================================="
echo ""
echo "Services enabled:"
echo "  - Docker containers (Graphite, Grafana)"
if systemctl list-unit-files | grep -q mqtt-graphite-bridge.service; then
    echo "  - MQTT Bridge (systemd service)"
fi
echo ""
echo "Everything will start automatically on system boot."
echo ""
echo "Service management commands:"
echo "  sudo systemctl start mqtt-graphite-grafana    # Start now"
echo "  sudo systemctl stop mqtt-graphite-grafana     # Stop"
echo "  sudo systemctl restart mqtt-graphite-grafana  # Restart"
echo "  sudo systemctl status mqtt-graphite-grafana   # Check status"
echo "  sudo systemctl disable mqtt-graphite-grafana  # Disable auto-start"
echo ""

# Ask if user wants to start now
read -p "Start the service now? (yes/no): " START_NOW

if [ "$START_NOW" = "yes" ]; then
    echo ""
    echo -e "${YELLOW}Starting service...${NC}"
    sudo systemctl start mqtt-graphite-grafana.service
    echo ""
    echo -e "${GREEN}Service started!${NC}"
    echo ""
    sudo systemctl status mqtt-graphite-grafana.service --no-pager
fi

echo ""
echo -e "${GREEN}Done!${NC}"
