# Legacy WLab Application - Refactoring Summary

## Directory Structure

```
legacy-wlab-app/
├── README.md                          # Main documentation
├── wlabapp/                           # Original legacy application (archived)
│   ├── wlab_datap/                    # Old data provider (MQTT + file database)
│   └── wlab_webapp/                   # Old Flask web app (IPC communication)
├── web-viewer/                        # NEW: Refactored web viewer
│   ├── src/
│   │   └── app.py                     # Modern Python 3 Flask app
│   ├── static/                        # CSS, JS, images (copied from wlabapp)
│   ├── templates/
│   │   └── index.html                 # Main web interface
│   ├── config.example.json            # Configuration template
│   ├── config.json                    # Active configuration (gitignored)
│   └── requirements.txt               # Python dependencies
├── scripts/
│   └── install-service.sh             # Systemd service installer
└── systemd/
    └── (service files created during install)
```

## What Changed

### Old Architecture (Archived in `wlabapp/`)
```
MQTT → MqttCatcher → DataProvider → File Database (JSON)
                                          ↓
                                    Unix Socket IPC
                                          ↓
                                    Flask Web App → Browser
```

### New Architecture (`web-viewer/`)
```
Browser → Flask App → Graphite HTTP API → Whisper Database
```

## Key Improvements

1. **Simplified Architecture**
   - ✅ No MQTT handling (done by mqtt-bridge service)
   - ✅ No file-based database (uses Graphite)
   - ✅ No IPC communication needed
   - ✅ Single Python process

2. **Modern Python 3**
   - ✅ Python 3.11+ compatible
   - ✅ Updated dependencies (Flask 3.x, requests)
   - ✅ Proper logging and error handling
   - ✅ Clean, readable code

3. **Direct Graphite Integration**
   - ✅ Reads metrics via Graphite render API
   - ✅ No database migration needed
   - ✅ Real-time data from Graphite
   - ✅ Supports time range queries

4. **Easy Deployment**
   - ✅ Systemd service support
   - ✅ Simple configuration (single JSON file)
   - ✅ One-command installation
   - ✅ Separate from main monitoring stack

## Configuration

The web viewer connects to Graphite and reads metrics in the format:
```
monitoring_data.{DEVICENAME}_{UID}.{Serie}.{min,max,avg}
```

Example:
```
monitoring_data.RODOS_110020FF0001.Temperature.min
monitoring_data.RODOS_110020FF0001.Temperature.max
monitoring_data.RODOS_110020FF0001.Temperature.avg
```

## Installation

```bash
cd legacy-wlab-app

# Install as systemd service
sudo ./scripts/install-service.sh

# Start service
sudo systemctl start wlab-viewer

# Enable auto-start
sudo systemctl enable wlab-viewer
```

Access at: http://localhost:8050

## API Endpoints

The refactored app provides:

- `GET /` - Web interface
- `GET /api/stations` - List all stations from Graphite
- `GET /api/stations/{uid}/series/{serie}/data` - Get time-series data
  - Params: `from`, `until` (e.g., `-24h`, `now`)
- `GET /api/datatree` - Hierarchical view of all data
- `GET /api/health` - Health check

## Migration Notes

### What's Preserved
- ✅ Same web interface look and feel
- ✅ Compatible with existing Graphite metrics
- ✅ Legacy device mapping (UID → Name)

### What's Removed
- ❌ MQTT data ingestion (handled by mqtt-graphite-bridge)
- ❌ File-based database (uses Graphite)
- ❌ IPC communication (direct HTTP calls)
- ❌ Separate data provider service

### What's New
- ✨ RESTful API with JSON responses
- ✨ Direct Graphite queries
- ✨ Time range selection
- ✨ Health check endpoint
- ✨ Modern Python 3 code

## Why This Approach?

The original wlab application had two components:
1. **wlab_datap**: Received MQTT data and stored it in files
2. **wlab_webapp**: Web interface that read from those files

In the new architecture:
- MQTT data ingestion → Handled by `mqtt-graphite-bridge` service
- Data storage → Graphite/Whisper database
- Web interface → This refactored viewer

Benefits:
- No code duplication
- Single source of truth (Graphite)
- Easier maintenance
- Better performance
- Simpler deployment

## Future Enhancements

Possible improvements:
- [ ] Add user authentication
- [ ] Add data export (CSV, JSON)
- [ ] Add alerting/notifications
- [ ] Add dashboard customization
- [ ] Add multi-language support
- [ ] Add mobile-responsive design improvements

## Troubleshooting

**Can't see any stations:**
```bash
# Check Graphite has data
curl "http://localhost:8040/metrics/find?query=monitoring_data.*"
```

**Service won't start:**
```bash
journalctl -u wlab-viewer -n 50
```

**Connection refused:**
```bash
# Check Graphite is running
curl http://localhost:8040/
```

## License

GPL-3.0 (same as parent project)
