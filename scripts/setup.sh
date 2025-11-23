#!/bin/bash
# Setup script for MQTT-Graphite-Grafana Stack on Raspberry Pi CM4

set -e

echo "=========================================="
echo "MQTT-Graphite-Grafana Stack Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if config.json exists
if [ ! -f config.json ]; then
    echo -e "${RED}Error: config.json not found!${NC}"
    echo ""
    echo "Please create your configuration from the template:"
    echo -e "  ${GREEN}cp config_template.json config.json${NC}"
    echo -e "  ${GREEN}nano config.json${NC}  # Edit with your settings"
    echo ""
    echo "Important: Update these settings in config.json:"
    echo "  - mqtt.broker: Your MQTT broker address"
    echo "  - mqtt.topic_prefix: Your MQTT topic prefix"
    echo "  - grafana.admin_password: Change from default!"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ config.json found${NC}"

# Validate critical settings
GRAFANA_PASS=$(grep -o '"admin_password":[^,]*' config.json | grep -o '\"[^\"]*\"' | tail -1 | tr -d '"')
if [ "$GRAFANA_PASS" = "change_this_password" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}WARNING: Using default Grafana password!${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "Please change grafana.admin_password in config.json"
    echo -e "Press ${YELLOW}Ctrl+C${NC} to cancel, or ${GREEN}Enter${NC} to continue anyway"
    read
fi

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
    echo -e "${YELLOW}Warning: Not running on Raspberry Pi${NC}"
else
    MODEL=$(cat /proc/device-tree/model)
    echo -e "${GREEN}Detected: $MODEL${NC}"
fi

# Check for required commands
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed${NC}"
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker is installed${NC}"
    # Ensure user is in docker group
    if ! groups $USER | grep -q docker; then
        echo -e "${YELLOW}Adding user to docker group...${NC}"
        sudo usermod -aG docker $USER
    fi
fi

# Ensure Docker daemon is running
echo "Ensuring Docker daemon is running..."
if ! systemctl is-active --quiet docker 2>/dev/null; then
    echo "Docker service is not running. Starting it..."
    sudo systemctl enable --now docker
    sleep 2
    if ! systemctl is-active --quiet docker 2>/dev/null; then
        echo -e "${RED}Failed to start Docker service${NC}"
        exit 1
    fi
    echo -e "${GREEN}Docker service started${NC}"
else
    echo -e "${GREEN}Docker service is running${NC}"
fi

# Check for docker-compose (either standalone or plugin)
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}Docker Compose is installed (standalone)${NC}"
elif docker compose version &> /dev/null; then
    echo -e "${GREEN}Docker Compose is installed (plugin)${NC}"
    # Create alias for docker-compose command if it doesn't exist
    if ! command -v docker-compose &> /dev/null; then
        echo "Creating docker-compose alias..."
        sudo tee /usr/local/bin/docker-compose > /dev/null <<'EOF'
#!/bin/bash
docker compose "$@"
EOF
        sudo chmod +x /usr/local/bin/docker-compose
        echo -e "${GREEN}Docker Compose alias created${NC}"
    fi
else
    echo -e "${YELLOW}Docker Compose is not installed${NC}"
    echo "Installing Docker Compose plugin..."
    # Install docker-compose-plugin instead of docker-compose package
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    # Create alias for backward compatibility
    sudo tee /usr/local/bin/docker-compose > /dev/null <<'EOF'
#!/bin/bash
docker compose "$@"
EOF
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose plugin installed${NC}"
fi

# Generate .env file from config.json
echo ""
echo "Generating .env file from config.json..."

# Use Python to extract JSON values properly
python3 << 'PYPYTHON'
import json
import os

with open('config.json', 'r') as f:
    config = json.load(f)

env_content = """# Auto-generated from config.json - DO NOT EDIT MANUALLY
# Edit config.json and re-run setup.sh to update

# MQTT Configuration
MQTT_BROKER="{broker}"
MQTT_PORT={port}
MQTT_TOPIC_PREFIX="{topic_prefix}"
MQTT_TOPIC="{topic}"
MQTT_USERNAME="{username}"
MQTT_PASSWORD="{password}"

# Graphite Configuration
GRAPHITE_HOST=graphite
GRAPHITE_PORT=2003
GRAPHITE_TIME_ZONE="{timezone}"

# Grafana Configuration
GF_SECURITY_ADMIN_USER="{admin_user}"
GF_SECURITY_ADMIN_PASSWORD="{admin_password}"

# Logging
LOG_LEVEL=INFO
""".format(
    broker=config['mqtt']['broker'],
    port=config['mqtt']['port'],
    topic_prefix=config['mqtt']['topic_prefix'],
    topic=config['mqtt']['topic'],
    username=config['mqtt']['username'],
    password=config['mqtt']['password'],
    timezone=config['graphite']['timezone'],
    admin_user=config['grafana']['admin_user'],
    admin_password=config['grafana']['admin_password']
)

with open('.env', 'w') as f:
    f.write(env_content)

print("✓ .env file generated")
PYPYTHON

# Load configuration
echo ""
echo "Loading configuration from config.json..."
if [ ! -f config.json ]; then
    echo -e "${RED}config.json not found!${NC}"
    exit 1
fi

# Extract database paths from config.json
BASE_PATH=$(grep -o '"base_path":[^,]*' config.json | grep -o '"/[^"]*"' | tr -d '"')
GRAPHITE_PATH=$(grep -o '"graphite_path":[^,]*' config.json | grep -o '"/[^"]*"' | tr -d '"')
GRAFANA_PATH=$(grep -o '"grafana_path":[^,]*' config.json | grep -o '"/[^"]*"' | tr -d '"')

# Create base monitoring data directory
echo ""
echo "Creating monitoring data directories at: $BASE_PATH"
sudo mkdir -p "$BASE_PATH"

# Create Graphite data directory structure
echo "Creating Graphite database at: $GRAPHITE_PATH"
sudo mkdir -p "$GRAPHITE_PATH"/{whisper,rrd,log,lists}
sudo chown -R $(id -u):$(id -g) "$GRAPHITE_PATH"
echo -e "${GREEN}Graphite data directory created${NC}"

# Create Grafana data directory
echo "Creating Grafana database at: $GRAFANA_PATH"
sudo mkdir -p "$GRAFANA_PATH"
sudo chown -R 472:472 "$GRAFANA_PATH"  # Grafana user ID
echo -e "${GREEN}Grafana data directory created${NC}"

echo -e "${GREEN}All data directories created successfully${NC}"

# Pull Docker images
echo ""
echo "Pulling Docker images (Graphite, Grafana)..."
sudo docker compose pull graphite grafana
echo -e "${GREEN}Images pulled successfully${NC}"

# Install MQTT bridge as systemd service
echo ""
echo "Installing MQTT bridge as systemd service..."
./scripts/install-mqtt-bridge.sh

echo ""
echo "=========================================="
echo -e "${GREEN}Setup completed successfully!${NC}"
echo "=========================================="
echo ""

# Check if user needs docker group access
if ! groups | grep -q docker; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}IMPORTANT: Docker group configuration needed${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Your user was added to the 'docker' group."
    echo "To use Docker without sudo, run ONE of these:"
    echo ""
    echo -e "  ${GREEN}newgrp docker${NC}  (activate in current session)"
    echo "  OR"
    echo -e "  ${GREEN}exit${NC} and log back in (permanent)"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
fi

echo "Next steps:"
echo "1. Start the services:"
echo "   ./scripts/start.sh"
echo ""
echo "2. Start the stack:"
echo "   ./scripts/start.sh"
echo ""
echo "3. Enable auto-start on boot (optional):"
echo "   ./scripts/enable-autostart.sh"
echo ""
echo "4. Access the services:"
echo "   - Grafana: http://localhost:8041 (admin/admin)"
echo "   - Graphite: http://localhost:8040"
echo ""
