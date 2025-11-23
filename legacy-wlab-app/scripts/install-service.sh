#!/bin/bash
# Install WLab Web Viewer as systemd service

set -e

echo "Installing WLab Web Viewer as systemd service..."

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/wlab-viewer"

echo "Project directory: $PROJECT_DIR"
echo "Installation directory: $INSTALL_DIR"

# Create installation directory
echo "Creating installation directory..."
sudo mkdir -p "$INSTALL_DIR"

# Copy application files
echo "Copying application files..."
sudo cp -r "$PROJECT_DIR/web-viewer/src" "$INSTALL_DIR/"
sudo cp -r "$PROJECT_DIR/web-viewer/static" "$INSTALL_DIR/" 2>/dev/null || echo "No static directory"
sudo cp -r "$PROJECT_DIR/web-viewer/templates" "$INSTALL_DIR/" 2>/dev/null || echo "No templates directory"
sudo cp "$PROJECT_DIR/web-viewer/requirements.txt" "$INSTALL_DIR/"
sudo cp "$PROJECT_DIR/web-viewer/config.example.json" "$INSTALL_DIR/config.json"

# Create virtual environment
echo "Creating Python virtual environment..."
sudo python3 -m venv "$INSTALL_DIR/venv"
sudo "$INSTALL_DIR/venv/bin/pip" install --upgrade pip
sudo "$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"

# Create logs directory
sudo mkdir -p "$INSTALL_DIR/logs"

# Copy static files and templates from old wlabapp if they exist
if [ -d "$PROJECT_DIR/wlabapp/wlab_webapp/static" ]; then
    echo "Copying legacy static files..."
    sudo mkdir -p "$INSTALL_DIR/static"
    sudo cp -r "$PROJECT_DIR/wlabapp/wlab_webapp/static"/* "$INSTALL_DIR/static/" || true
fi

if [ -d "$PROJECT_DIR/wlabapp/wlab_webapp/templates" ]; then
    echo "Copying legacy templates..."
    sudo mkdir -p "$INSTALL_DIR/templates"
    sudo cp -r "$PROJECT_DIR/wlabapp/wlab_webapp/templates"/* "$INSTALL_DIR/templates/" || true
fi

# Create systemd service file
echo "Creating systemd service..."
sudo tee /etc/systemd/system/wlab-viewer.service > /dev/null <<EOF
[Unit]
Description=WLab Web Viewer
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
Environment="PYTHONUNBUFFERED=1"
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/src/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "Reloading systemd..."
sudo systemctl daemon-reload

echo ""
echo "✓ WLab Web Viewer installed successfully!"
echo ""
echo "Configuration file: $INSTALL_DIR/config.json"
echo "Edit it with your Graphite settings if needed."
echo ""
echo "Service commands:"
echo "  sudo systemctl start wlab-viewer    # Start the viewer"
echo "  sudo systemctl stop wlab-viewer     # Stop the viewer"
echo "  sudo systemctl enable wlab-viewer   # Enable auto-start on boot"
echo "  sudo systemctl status wlab-viewer   # Check status"
echo "  journalctl -u wlab-viewer -f        # View logs"
echo ""
echo "Access the web interface at: http://localhost:8050"
