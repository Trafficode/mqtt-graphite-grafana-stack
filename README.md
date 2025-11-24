# MQTT Graphite Grafana Stack

Weather monitoring system with MQTT data collection, Graphite storage, and web visualization.

## Overview

This project refactors a legacy weather monitoring application to use modern components:

- **Mosquitto MQTT Broker**: Local message broker for IoT device data
- **MQTT-Graphite Bridge**: Service that forwards MQTT messages to Graphite with support for multiple data formats
- **Graphite**: Time-series database for metric storage
- **Flask Web Viewer**: Web interface serving original UI with Graphite backend

## Architecture

```
Weather Stations
    ↓ (MQTT)
Mosquitto Broker (localhost:1883)
    ↓
MQTT-Graphite Bridge (systemd service)
    ↓ (Carbon plaintext protocol)
Graphite (Docker, port 8040)
    ↑
Flask Web Viewer (port 8050)
    ↓
Web Browser (Original UI)
```

## Components

### 1. Mosquitto MQTT Broker

Local MQTT broker for receiving data from weather stations.

**Location**: Installed system-wide via apt  
**Port**: 1883  
**Config**: `/etc/mosquitto/conf.d/local.conf`

See [mosquitto/README.md](mosquitto/README.md) for detailed documentation.

**Quick Start**:
```bash
# Check status
sudo systemctl status mosquitto

# View logs
sudo journalctl -u mosquitto -f

# Test connection
mosquitto_sub -h localhost -t '#' -v
```

### 2. MQTT-Graphite Bridge

Python service that subscribes to MQTT topics and forwards data to Graphite.

**Location**: `/opt/mqtt-graphite-bridge/`  
**Service**: `mqtt-graphite-bridge.service`  
**Config**: `config.json` in workspace root

**Supported Data Formats**:
- **New JSON format**: Topic `wlab/graphite/+/data`
- **Legacy binary format**: Topic `/wlabdb/bin` (RODOS station)
- **Legacy JSON format**: Topic `/wlabdb` (MAKRO station)

**Features**:
- Device filtering (skips ZLOCIEN, KRAKERS)
- UID normalization (removes underscores)
- Consistent metric naming: `monitoring_data.NAME_UID.Serie.{min,max,avg}`

**Active Stations**:
- RODOS (110020FF0001) - Legacy binary format
- MAKRO (48E729C88B0C) - Legacy JSON format
- GRROD (2CCF67F123B6) - New JSON format

See [mqtt-bridge/README.md](mqtt-bridge/README.md) for details.

**Management**:
```bash
# Status
sudo systemctl status mqtt-graphite-bridge

# Restart after config changes
sudo systemctl restart mqtt-graphite-bridge

# View logs
sudo journalctl -u mqtt-graphite-bridge -f

# Update bridge code
cp mqtt-bridge/bridge.py /opt/mqtt-graphite-bridge/
sudo systemctl restart mqtt-graphite-bridge
```

### 3. Graphite

Time-series database storing weather metrics.

**Type**: Docker container (graphiteapp/graphite-statsd)  
**Port**: 8040  
**Metrics Format**: `monitoring_data.NAME_UID.Serie.{min,max,avg}`

**Web Interface**: http://localhost:8040

**Data Series**:
- Serie 1: Temperature (°C)
- Serie 2: Humidity (%)

**Query Example**:
```bash
# Get RODOS temperature for last 24 hours
curl "http://localhost:8040/render?target=monitoring_data.RODOS_110020FF0001.1.avg&from=-24h&format=json"
```

### 4. Flask Web Viewer

Web application serving the original UI with Graphite backend.

**Location**: `legacy-wlab-app/web-viewer/`  
**Port**: 8050  
**Framework**: Flask 3.0.0

**Features**:
- Original UI preserved (translated to English)
- REST API compatible with original IPC interface
- Real-time data from Graphite
- Historical data (November 2025 full month)

**Tabs**:
- **HOME**: Current day temperature/humidity charts
- **HISTORY**: Monthly and yearly charts
- **INFO**: Station information and status

**Run Manually**:
```bash
cd legacy-wlab-app/web-viewer
python3 src/app.py
```

**Access**: http://localhost:8050

## Installation

### Prerequisites

```bash
# Update system
sudo apt update

# Install Python 3
sudo apt install -y python3 python3-pip

# Install Docker (for Graphite)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 1. Install Mosquitto

```bash
sudo apt install -y mosquitto mosquitto-clients

# Copy configuration
sudo cp mosquitto/local.conf /etc/mosquitto/conf.d/

# Restart service
sudo systemctl restart mosquitto
sudo systemctl enable mosquitto

# Verify
sudo systemctl status mosquitto
```

### 2. Start Graphite

```bash
docker run -d \
  --name graphite \
  --restart=always \
  -p 8040:80 \
  -p 2003-2004:2003-2004 \
  -p 2023-2024:2023-2024 \
  -p 8125:8125/udp \
  -p 8126:8126 \
  graphiteapp/graphite-statsd
```

### 3. Install MQTT-Graphite Bridge

```bash
# Install Python dependencies
pip3 install paho-mqtt

# Copy bridge to system location
sudo mkdir -p /opt/mqtt-graphite-bridge
sudo cp mqtt-bridge/bridge.py /opt/mqtt-graphite-bridge/
sudo cp config.json /opt/mqtt-graphite-bridge/

# Install systemd service
sudo cp mqtt-bridge/install-mqtt-bridge.sh /opt/mqtt-graphite-bridge/
cd /opt/mqtt-graphite-bridge
sudo bash install-mqtt-bridge.sh

# Start service
sudo systemctl start mqtt-graphite-bridge
sudo systemctl enable mqtt-graphite-bridge
```

### 4. Install Flask Web Viewer

```bash
# Install dependencies
cd legacy-wlab-app/web-viewer
pip3 install -r requirements.txt

# Run manually (or install as systemd service)
python3 src/app.py
```

## Configuration

### MQTT Broker Settings

Edit `/etc/mosquitto/conf.d/local.conf`:

```conf
listener 1883
allow_anonymous true
```

### MQTT Bridge Settings

Edit `config.json`:

```json
{
  "mqtt": {
    "broker": "localhost",
    "port": 1883,
    "topics": [
      "wlab/graphite/+/data",
      "/wlabdb/bin",
      "/wlabdb"
    ]
  },
  "graphite": {
    "host": "localhost",
    "port": 2003
  }
}
```

### Web Viewer Settings

Edit `legacy-wlab-app/web-viewer/src/app.py`:

```python
GRAPHITE_URL = "http://localhost:8040"
FLASK_PORT = 8050
```

## Data Import

Historical data from legacy database can be imported:

```bash
# Import RODOS data
cd scripts
python3 import-humidity-data.py

# Import MAKRO data
python3 import-makro-data.py
```

**Data Source**: `/mnt/nvme/tmp/database/`  
**Imported Period**: November 2025 (full month)  
**Metrics Imported**:
- RODOS: 9,762 Temperature + 9,762 Humidity
- MAKRO: 9,405 Temperature + 9,405 Humidity

## Monitoring

### Check All Services

```bash
# Mosquitto
sudo systemctl status mosquitto

# Graphite (Docker)
docker ps | grep graphite

# MQTT Bridge
sudo systemctl status mqtt-graphite-bridge

# Web Viewer (if installed as service)
sudo systemctl status wlab-web-viewer
```

### Monitor MQTT Messages

```bash
# All topics
mosquitto_sub -h localhost -t '#' -v

# Specific station
mosquitto_sub -h localhost -t 'wlab/graphite/2CCF67F123B6/data' -v
```

### View Graphite Metrics

```bash
# List all metrics
curl "http://localhost:8040/metrics/index.json"

# Query specific metric
curl "http://localhost:8040/render?target=monitoring_data.RODOS_110020FF0001.1.avg&from=-1h&format=json"
```

### Check Web Viewer

```bash
# Station list
curl http://localhost:8050/restq/stations/desc

# Latest data
curl http://localhost:8050/restq/stations/newest

# Monthly data
curl "http://localhost:8050/restq/station/monthlyserie/RODOS_110020FF0001/1/2025/11"
```

## Troubleshooting

### MQTT Bridge Not Receiving Data

```bash
# Check MQTT connection
mosquitto_sub -h localhost -t '#' -v

# Check bridge logs
sudo journalctl -u mqtt-graphite-bridge -f

# Restart bridge
sudo systemctl restart mqtt-graphite-bridge
```

### No Data in Graphite

```bash
# Check Graphite is running
docker ps | grep graphite

# Check Carbon (Graphite receiver) is listening
netstat -tlnp | grep 2003

# Test manual write
echo "test.metric 42 $(date +%s)" | nc localhost 2003
```

### Web Viewer Shows No Stations

```bash
# Check Graphite has data
curl "http://localhost:8040/metrics/index.json" | grep monitoring_data

# Check Flask logs
cd legacy-wlab-app/web-viewer
python3 src/app.py  # Run in foreground to see errors
```

### Historical Data Missing

Run data import scripts:

```bash
cd scripts
python3 import-humidity-data.py
python3 import-makro-data.py
```

## Maintenance

### Update MQTT Bridge

After editing `mqtt-bridge/bridge.py`:

```bash
sudo cp mqtt-bridge/bridge.py /opt/mqtt-graphite-bridge/
sudo systemctl restart mqtt-graphite-bridge
```

### Backup Graphite Data

```bash
# Backup Graphite volume
docker exec graphite tar czf /tmp/whisper-backup.tar.gz /opt/graphite/storage/whisper/

# Copy to host
docker cp graphite:/tmp/whisper-backup.tar.gz ./graphite-backup-$(date +%Y%m%d).tar.gz
```

### Clear Retained MQTT Messages

```bash
# Clear specific topic
mosquitto_pub -h localhost -t 'topic/path' -r -n

# List retained messages
mosquitto_sub -h localhost -t '#' --retained-only
```

### Remove Device Data from Graphite

```bash
# Access Graphite container
docker exec -it graphite bash

# Remove device metrics
cd /opt/graphite/storage/whisper/monitoring_data/
rm -rf DEVICE_NAME_UID/
```

## Project Structure

```
mqtt-graphite-grafana-stack/
├── mosquitto/                    # Mosquitto MQTT broker
│   ├── README.md                # Detailed documentation
│   └── local.conf               # Configuration file
├── mqtt-bridge/                 # MQTT to Graphite bridge
│   ├── bridge.py               # Main bridge script
│   ├── install-mqtt-bridge.sh  # Service installer
│   └── README.md               # Bridge documentation
├── legacy-wlab-app/            # Web viewer
│   └── web-viewer/
│       ├── src/
│       │   └── app.py         # Flask application
│       ├── static/            # JavaScript, CSS, images
│       └── templates/         # HTML templates
├── scripts/                    # Utility scripts
│   ├── import-humidity-data.py
│   └── import-makro-data.py
├── config.json                # MQTT bridge configuration
└── README.md                  # This file
```

## API Reference

### REST Endpoints

**Base URL**: http://localhost:8050

#### Get Station List
```
GET /restq/stations/desc
Response: {"RODOS_110020FF0001": {...}, ...}
```

#### Get Latest Data
```
GET /restq/stations/newest
Response: {"RODOS_110020FF0001": {"1": {...}, "2": {...}}, ...}
```

#### Get Monthly Data
```
GET /restq/station/monthlyserie/<station_uid>/<serie>/<year>/<month>
Example: /restq/station/monthlyserie/RODOS_110020FF0001/1/2025/11
```

#### Get Yearly Data
```
GET /restq/station/yearlyserie/<station_uid>/<serie>/<year>
Example: /restq/station/yearlyserie/RODOS_110020FF0001/1/2025
```

#### Get Available Dates
```
GET /restq/stations/datatree
Response: {"RODOS_110020FF0001": {"2025": {"11": [1,2,3,...,30]}}, ...}
```

### MQTT Topics

#### New JSON Format
```
Topic: wlab/graphite/<UID>/data
Payload: {"data": [{"serie": 1, "min": 20.5, "max": 21.2, "avg": 20.8}, ...]}
```

#### Legacy Binary Format
```
Topic: /wlabdb/bin
Payload: Binary struct (RODOS station)
```

#### Legacy JSON Format
```
Topic: /wlabdb
Payload: JSON with legacy structure (MAKRO station)
```

## Migration Notes

### From Legacy App to New System

The refactored system maintains the same UI/UX but with modern backend:

**Before**:
- Custom database
- Direct MQTT integration in app
- Python 2.7

**After**:
- Graphite database
- Separate MQTT bridge service
- Python 3
- Original UI preserved

**Changes Required for Devices**:
- Update MQTT broker address from `194.42.111.14:1883` to `<raspberry-pi-ip>:1883`
- No changes to data format needed (bridge supports all formats)

## Performance

**Mosquitto**: ~5-10 MB RAM, <1% CPU  
**MQTT Bridge**: ~20-30 MB RAM, <1% CPU  
**Graphite**: ~200-300 MB RAM, 5-10% CPU  
**Flask**: ~40-50 MB RAM, <1% CPU (when idle)

**Total**: ~300 MB RAM for full stack

## License

See LICENSE file.

## Support

For issues, check:
1. Service logs: `sudo journalctl -u <service-name> -f`
2. MQTT messages: `mosquitto_sub -h localhost -t '#' -v`
3. Graphite data: http://localhost:8040
4. Web viewer: http://localhost:8050

Complete MQTT → Graphite → Grafana monitoring stack for Raspberry Pi CM4 with Docker.

## Quick Start

```bash
# 1. Clone and enter directory
git clone https://github.com/Trafficode/mqtt-graphite-grafana-stack.git
cd mqtt-graphite-grafana-stack

# 2. Create your configuration from template
cp config_template.json config.json
nano config.json  # Edit with your settings (MQTT broker, passwords, etc.)

# 3. Run setup (installs Docker, dependencies, MQTT bridge service, creates directories)
chmod +x scripts/*.sh
./scripts/setup.sh

# 4. Start everything
./scripts/start.sh

# 5. Enable auto-start on boot (optional but recommended)
./scripts/enable-autostart.sh

# 6. (Optional) Setup NVMe storage for production
sudo ./scripts/setup-nvme.sh
# Then update base_path in config.json to /mnt/nvme/monitoring-data
# Re-run: ./scripts/setup.sh && ./scripts/start.sh

# 7. (Optional) Setup automated daily backups
sudo ./scripts/install-backup-service.sh
```

**Access:**
- Grafana: `http://YOUR_IP:8041` (default: admin/change_this_password)
- Graphite: `http://YOUR_IP:8040`

⚠️ **Important:** Change the default Grafana password in `config.json` before running setup!

**That's it!** Send MQTT data and visualize in Grafana.

## 🔒 Security Notice

**Before deploying:**
1. **Never commit `config.json` or `.env`** - they contain sensitive credentials
2. **Change default passwords** in `config.json`:
   - `grafana.admin_password` (default: "change_this_password")
   - `mqtt.username` and `mqtt.password` if your broker requires auth
3. **Restrict network access** to Grafana (8041) and Graphite (8040) ports
4. **Use strong passwords** - the defaults are insecure placeholders
5. Files in `.gitignore`: `config.json`, `.env`, `data/`

**Configuration workflow:**
- Edit `config.json` with your settings (MQTT broker, passwords, etc.)
- Run `./scripts/setup.sh` - it auto-generates `.env` from `config.json`
- Don't edit `.env` manually - it's auto-generated
- `.env.example` is just a reference/template (not used by setup)

## Architecture

- **Graphite**: Time-series database (Docker container on port 8040)
- **Grafana**: Visualization platform (Docker container on port 8041)
- **MQTT Bridge**: Python service that forwards MQTT → Graphite (systemd service)
- **Database Storage**: Configurable (default: `/opt/monitoring-data`, recommended: `/mnt/nvme/monitoring-data`)
- **Backup Storage**: `/mnt/nvme/monitoring-data-backup` (daily automated backups)

## MQTT Data Format

**Topic format:** `{topic_prefix}/UID/data`  
**Example:** `sensors/home/BEDROOM_001/data`

Send JSON with optional sensor name for easier identification:

```json
{
  "sensor_name": "Bedroom Sensor",
  "Temperature": {
    "ts": 1732233600,
    "unit": "C",
    "min": 12.9,
    "min_ts": 1732233000,
    "max": 44.1,
    "max_ts": 1732233200,
    "avg": 22.9
  },
  "Humidity": {
    "ts": 1732233600,
    "unit": "%",
    "min": 45.2,
    "min_ts": 1732233000,
    "max": 78.5,
    "max_ts": 1732233200,
    "avg": 65.0
  }
}
```

**Field descriptions:**
- `sensor_name` (optional): Friendly name for the sensor
- `ts` (optional): Main timestamp in UTC (Unix epoch), defaults to current time
- `unit` (optional): Measurement unit for documentation
- `min`, `max`, `avg`: Statistical values for the measurement period
- `min_ts`, `max_ts` (REQUIRED): UTC timestamps when min/max values occurred

**Creates metrics:**
- By UID: `sensors.home.BEDROOM_001.Temperature.{min,max,avg}`
- By Name: `sensors.home.bedroom_sensor.Temperature.{min,max,avg}`

**Important notes:**
- All timestamps must be in UTC (Unix epoch seconds)
- `min_ts` and `max_ts` are **mandatory** when sending min/max values
- Multiple sensor types can be included in one message (Temperature, Humidity, Pressure, etc.)
- Only JSON format is supported

**Configuration:** Edit `topic_prefix` in `config.json` or set `MQTT_TOPIC_PREFIX` in `.env`

### Legacy Binary Format Support

The bridge also supports legacy binary format for backward compatibility with old devices that send data to `/wlabdb/bin`:

- **Topic:** `/wlabdb/bin` (fixed, no prefix applied)
- **Format:** Binary packets (37 bytes per sample)
- **Contains:** Temperature and Humidity with min/max/avg and timestamps
- **Known devices:** Automatically maps UIDs to device names (Rodos, Zlocien, Makro, Krakers)
- **Metrics:** Creates `monitoring_data.DEVICENAME_UID.{Temperature,Humidity}.{min,max,avg}`

This format is automatically handled - no configuration needed.

## Management

```bash
./scripts/start.sh              # Start all services
./scripts/stop.sh               # Stop all services
./scripts/restart.sh            # Restart all services
./scripts/status.sh             # Check status
./scripts/logs.sh               # View logs (journalctl)
./scripts/enable-autostart.sh   # Enable auto-start on boot
```

**Auto-start on boot:**
- Services automatically start after system reboot
- Run `./scripts/enable-autostart.sh` once to configure
- Uses systemd service: `mqtt-graphite-grafana.service`

## NVMe Storage Configuration

For production deployments on Raspberry Pi CM4 with NVMe SSD:

```bash
# Setup NVMe storage (formats, mounts, configures auto-mount)
sudo ./scripts/setup-nvme.sh

# Update config.json to use NVMe storage
nano config.json  # Change base_path to /mnt/nvme/monitoring-data

# Re-run setup to apply new paths
./scripts/setup.sh

# Restart services
./scripts/stop.sh && ./scripts/start.sh
```

**What `setup-nvme.sh` does:**
- Detects NVMe device automatically
- Creates GPT partition table
- Formats as ext4 filesystem
- Mounts to `/mnt/nvme`
- Adds to `/etc/fstab` for auto-mount on boot
- Creates monitoring-data directory
- Idempotent (safe to re-run)

## Automated Backups

Daily automated backups with systemd timer:

```bash
# Install backup service (runs daily at 2:00 AM)
sudo ./scripts/install-backup-service.sh
```

**Backup features:**
- Runs daily at 2:00 AM automatically
- Stops services → backs up databases → restarts services
- Compressed `.tar.gz` archives
- Stored in `/mnt/nvme/monitoring-data-backup/`
- Keeps last 30 days (auto-cleanup)
- Starts at system boot

**Manual backup commands:**
```bash
# Run backup now
sudo systemctl start monitoring-backup.service

# Check backup status
systemctl status monitoring-backup.timer
systemctl list-timers monitoring-backup.timer

# View backup logs
journalctl -u monitoring-backup.service

# List backups
ls -lh /mnt/nvme/monitoring-data-backup/

# Test backup script
sudo ./scripts/backup-databases.sh
```

**Backup process:**
1. Stops Docker containers (Graphite, Grafana)
2. Stops MQTT bridge service
3. Creates compressed archive of both databases
4. Restarts all services
5. Verifies services are running
6. Cleans up backups older than 30 days

**Syncthing integration:**
You can sync `/mnt/nvme/monitoring-data-backup/` to another machine for off-site backup using Syncthing or similar tools.

## Configuration Files

**⚠️ IMPORTANT: Never commit `config.json` to git - it contains sensitive data!**

**`config_template.json`** - Template for your configuration:
- Copy this to `config.json`: `cp config_template.json config.json`
- Edit `config.json` with your actual settings
- The `config.json` file is in `.gitignore` and won't be committed

**`config.json`** - Your actual configuration (not in repository):
- `mqtt.broker`: Your MQTT broker address
- `mqtt.topic_prefix`: MQTT topic prefix (e.g., "sensors/home")
- `grafana.admin_user`: Grafana admin username
- `grafana.admin_password`: **Change this!** Default is insecure
- `database.base_path`: Storage location (default: `/opt/monitoring-data`)
- `ports.*`: Service ports (Graphite: 8040, Grafana: 8041)

**`.env`** - Auto-generated runtime variables (DO NOT EDIT):
- Created automatically by `setup.sh` from `config.json`
- Also in `.gitignore` - contains sensitive data
- To change settings, edit `config.json` and re-run `setup.sh`

**`.env.example`** - Reference template only:
- Shows what variables are used
- Not used by setup process
- For documentation purposes only

## Troubleshooting

**Services won't start:**
```bash
./scripts/status.sh  # Check all services status
journalctl -u mqtt-graphite-bridge -f  # MQTT bridge logs
sudo docker compose logs -f  # Docker services logs
```

**MQTT not connecting:**
```bash
# Check MQTT bridge status and logs
sudo systemctl status mqtt-graphite-bridge
journalctl -u mqtt-graphite-bridge -f

# Test MQTT broker
mosquitto_sub -h YOUR_BROKER -t test
```

**Check systemd services:**
```bash
sudo systemctl status mqtt-graphite-grafana  # Docker containers
sudo systemctl status mqtt-graphite-bridge   # MQTT bridge
sudo systemctl status monitoring-backup.timer  # Backup timer
```

**Disable auto-start:**
```bash
sudo systemctl disable mqtt-graphite-grafana
sudo systemctl disable mqtt-graphite-bridge
sudo systemctl disable monitoring-backup.timer
```

**No data in Grafana:**
```bash
# Check bridge is receiving/forwarding data
journalctl -u mqtt-graphite-bridge -f | grep "Forwarded"

# Test with sample data
cd mqtt-bridge
python3 test_publish.py
```

**Permission errors:**
```bash
sudo chown -R $(id -u):$(id -g) /opt/monitoring-data
```

## License

GPL-3.0 - See [LICENSE](LICENSE) file

---

<details>
<summary><b>📖 Extended Documentation (Click to expand)</b></summary>

### Architecture

```
MQTT Broker → MQTT Bridge → Graphite (Carbon) → Grafana
                                ↓
                         /opt/monitoring-data
                         (external storage)
```

### Directory Structure

```
├── config.json                    # System configuration
├── .env                           # MQTT credentials
├── docker-compose.yml             # Services definition
├── docker/                        # Service configs
│   ├── graphite/                  # Graphite configs
│   └── grafana/                   # Grafana provisioning
├── mqtt-bridge/                   # Bridge service
└── scripts/                       # Management scripts
```

### Database Storage

All monitoring data stored in configurable location (see `config.json`):

**Default location:** `/opt/monitoring-data/`
```
/opt/monitoring-data/
├── graphite/
│   ├── whisper/    # Time-series database files
│   └── lists/      # Index files
└── grafana/        # Grafana dashboards, users, settings
```

**Production (NVMe):** `/mnt/nvme/monitoring-data/`
```
/mnt/nvme/
├── monitoring-data/           # Active database
│   ├── graphite/
│   └── grafana/
└── monitoring-data-backup/    # Daily automated backups
    ├── monitoring-backup-20251123_020000.tar.gz
    ├── monitoring-backup-20251124_020000.tar.gz
    └── ...
```

**Note:** Application logs are handled by systemd/journalctl:
- MQTT Bridge: `journalctl -u mqtt-graphite-bridge -f`
- Docker services: `sudo docker compose logs -f`
- Backup service: `journalctl -u monitoring-backup.service -f`

