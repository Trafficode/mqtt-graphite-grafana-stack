# WLab Web Viewer (Refactored)

Simple web interface for viewing monitoring data from Graphite.

## Overview

This is a modernized, simplified version of the legacy wlab web application that:
- Reads data from Graphite (instead of file-based database)
- Provides the same familiar web interface
- Uses Python 3 and modern dependencies
- Runs as a standalone systemd service

## Features

- ✅ Python 3.11+ compatible
- ✅ Flask-based REST API
- ✅ Bootstrap + CanvasJS charts
- ✅ Reads data directly from Graphite
- ✅ Systemd service integration
- ✅ Simple configuration

## Architecture

```
Browser → Flask App → Graphite API → Whisper DB
```

The app queries Graphite's render API to fetch metric data and serves it through a web interface.

## Requirements

- Python 3.11+
- Graphite running on localhost:8040 (or configured host)
- systemd (for service deployment)

## Installation

```bash
cd legacy-wlab-app/web-viewer

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure
cp config.example.json config.json
nano config.json  # Edit settings
```

## Configuration

Edit `config.json`:

```json
{
  "graphite": {
    "host": "localhost",
    "port": 8040,
    "protocol": "http"
  },
  "web": {
    "host": "0.0.0.0",
    "port": 8050,
    "debug": false
  },
  "logging": {
    "level": "INFO",
    "path": "./logs"
  }
}
```

## Running

### Development

```bash
source venv/bin/activate
python src/app.py
```

Access at: http://localhost:8050

### Production (systemd)

```bash
# Install service
sudo ./scripts/install-service.sh

# Start
sudo systemctl start wlab-viewer

# Enable auto-start
sudo systemctl enable wlab-viewer

# View logs
journalctl -u wlab-viewer -f
```

## API Endpoints

- `GET /` - Web interface
- `GET /api/stations` - List all stations from Graphite
- `GET /api/stations/{uid}/series` - Get available series for station
- `GET /api/stations/{uid}/{serie}/data` - Get time-series data
  - Query params: `from`, `until` (Unix timestamps or relative time like `-1d`)

## Graphite Integration

The app queries Graphite metrics in the format:
```
monitoring_data.{DEVICENAME}_{UID}.{Serie}.{min,max,avg}
```

Example:
```
monitoring_data.RODOS_110020FF0001.Temperature.min
monitoring_data.RODOS_110020FF0001.Temperature.max
monitoring_data.RODOS_110020FF0001.Temperature.avg
```

## Migration from Legacy

This version:
- ✅ No longer needs the old file-based database
- ✅ No longer needs IPC communication
- ✅ No longer needs separate data provider service
- ✅ Reads everything directly from Graphite
- ✅ Same web interface look and feel
- ✅ Compatible with existing monitoring_data metrics

## Development

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest tests/

# Format code
black src/
isort src/
```

## Troubleshooting

**Can't connect to Graphite:**
```bash
# Check Graphite is running
curl http://localhost:8040/

# Check metrics exist
curl "http://localhost:8040/metrics/find?query=monitoring_data.*"
```

**No data showing:**
```bash
# Verify metrics in Graphite
curl "http://localhost:8040/render?target=monitoring_data.*&format=json&from=-1h"
```

**Service won't start:**
```bash
journalctl -u wlab-viewer -n 50
systemctl status wlab-viewer
```

## License

GPL-3.0 (same as parent project)
