#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Installing MQTT Bridge as systemd service..."

# Install Python dependencies
echo "Installing Python dependencies..."
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv

# Create virtual environment
INSTALL_DIR="/opt/mqtt-graphite-bridge"
echo "Creating installation directory at $INSTALL_DIR..."
sudo mkdir -p $INSTALL_DIR

# Copy bridge script and config
echo "Copying bridge files..."
sudo cp mqtt-bridge/bridge.py $INSTALL_DIR/
sudo cp mqtt-bridge/config.yml $INSTALL_DIR/
sudo cp mqtt-bridge/requirements.txt $INSTALL_DIR/

# Create virtual environment and install dependencies
echo "Setting up Python virtual environment..."
sudo python3 -m venv $INSTALL_DIR/venv
sudo $INSTALL_DIR/venv/bin/pip install --upgrade pip
sudo $INSTALL_DIR/venv/bin/pip install -r $INSTALL_DIR/requirements.txt

# Create systemd service file
echo "Creating systemd service..."
sudo tee /etc/systemd/system/mqtt-graphite-bridge.service > /dev/null <<EOF
[Unit]
Description=MQTT to Graphite Bridge
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment="MQTT_BROKER=mqtt.example.com"
Environment="MQTT_PORT=1883"
Environment="MQTT_TOPIC_PREFIX=sensors/home"
Environment="MQTT_TOPIC=+/data"
Environment="GRAPHITE_HOST=localhost"
Environment="GRAPHITE_PORT=2003"
Environment="LOG_LEVEL=INFO"
ExecStart=$INSTALL_DIR/venv/bin/python bridge.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "Enabling MQTT bridge service..."
sudo systemctl daemon-reload
sudo systemctl enable mqtt-graphite-bridge.service

echo -e "${GREEN}✓ MQTT Bridge installed successfully!${NC}"
echo ""
echo "Service commands:"
echo "  sudo systemctl start mqtt-graphite-bridge   # Start the bridge"
echo "  sudo systemctl status mqtt-graphite-bridge  # Check status"
echo "  sudo systemctl stop mqtt-graphite-bridge    # Stop the bridge"
echo "  journalctl -u mqtt-graphite-bridge -f       # View logs"
