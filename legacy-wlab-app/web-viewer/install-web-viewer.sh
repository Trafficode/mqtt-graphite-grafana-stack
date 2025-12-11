#!/bin/bash
# Installation script for WLab Web Viewer systemd service

set -e

SERVICE_NAME="wlab-web-viewer"
INSTALL_DIR="/opt/${SERVICE_NAME}"
SERVICE_FILE="${SERVICE_NAME}.service"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== WLab Web Viewer Installation ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Create installation directory
echo "[1/7] Creating installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"

# Copy application files
echo "[2/7] Copying application files..."
cp -r "$CURRENT_DIR"/* "$INSTALL_DIR/"

# Create virtual environment
echo "[3/7] Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"

# Install dependencies
echo "[4/7] Installing Python dependencies..."
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"

# Set ownership
echo "[5/7] Setting ownership..."
if id "www-data" &>/dev/null; then
    chown -R www-data:www-data "$INSTALL_DIR"
else
    echo "Warning: www-data user not found, using current user"
    chown -R $SUDO_USER:$SUDO_USER "$INSTALL_DIR"
fi

# Install systemd service
echo "[6/7] Installing systemd service..."
cp "$INSTALL_DIR/$SERVICE_FILE" "/etc/systemd/system/$SERVICE_FILE"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "[7/7] Starting service..."
systemctl start "$SERVICE_NAME"

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Service Status:"
systemctl status "$SERVICE_NAME" --no-pager
echo ""
echo "Useful commands:"
echo "  Start:   sudo systemctl start $SERVICE_NAME"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "Web interface: http://$(hostname -I | awk '{print $1}'):8050"
echo "Health check:  http://$(hostname -I | awk '{print $1}'):8050/health"
echo "Metrics:       http://$(hostname -I | awk '{print $1}'):8050/metrics"
echo ""
