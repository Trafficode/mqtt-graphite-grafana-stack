# mqtt-graphite-grafana-stack

Complete MQTT → Graphite → Grafana monitoring stack for Raspberry Pi CM4 with Docker.

## Quick Start

```bash
# 1. Clone and enter directory
git clone https://github.com/Trafficode/mqtt-graphite-grafana-stack.git
cd mqtt-graphite-grafana-stack

# 2. Create your configuration from template
cp config_template.json config.json
nano config.json  # Edit with your settings (MQTT broker, passwords, etc.)

# 3. Run setup (installs Docker, MQTT bridge, creates directories)
chmod +x scripts/*.sh
./scripts/setup.sh

# 4. Install MQTT bridge as systemd service
./scripts/install-mqtt-bridge.sh

# 5. Start everything
./scripts/start.sh

# 6. Enable auto-start on boot (optional but recommended)
./scripts/enable-autostart.sh

# 7. (Optional) Setup NVMe storage for production
sudo ./scripts/setup-nvme.sh
# Then update base_path in config.json to /mnt/nvme/monitoring-data
# Re-run: ./scripts/setup.sh && ./scripts/start.sh

# 8. (Optional) Setup automated daily backups
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
    "timestamp": 1732233600,
    "unit": "C",
    "min": 12.9,
    "max": 44.1,
    "avg": 22.9
  },
  "Humidity": {
    "timestamp": 1732233600,
    "unit": "%",
    "min": 45.2,
    "max": 78.5,
    "avg": 65.0
  }
}
```

**Creates metrics:**
- By UID: `sensors.home.BEDROOM_001.Temperature.{min,max,avg}`
- By Name: `sensors.home.bedroom_sensor.Temperature.{min,max,avg}`

**Configuration:** Edit `topic_prefix` in `config.json` or set `MQTT_TOPIC_PREFIX` in `.env`

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

