# Quick Start Guide: MQTT-Graphite-Grafana Stack

This guide will walk you through setting up the complete monitoring stack from scratch.

## Prerequisites

- Raspberry Pi CM4 with Debian Trixie (or compatible Linux system)
- Internet connection
- SSH access to your Raspberry Pi

## Step-by-Step Installation

### Step 1: Clone the Repository

```bash
cd ~
git clone https://github.com/Trafficode/mqtt-graphite-grafana-stack.git
cd mqtt-graphite-grafana-stack
```

### Step 2: Review Configuration

Check the default configuration in `config.json`:

```bash
cat config.json
```

### Step 3: Run Setup Script

This will install Docker, create directories, and prepare the environment:

```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

**What this does:**
- Installs Docker and Docker Compose (if not already installed)
- Creates Graphite data directory (from `config.json`)
- Creates Grafana data directory
- Sets proper permissions
- Creates `.env` file from template
- Pulls Docker images

**Note:** If Docker was just installed, you may need to log out and log back in, then run `./scripts/setup.sh` again.

### Step 4: Configure MQTT Settings

Edit the `.env` file with your MQTT broker details:

```bash
nano .env
```

Update these values:
```bash
MQTT_BROKER=your-mqtt-broker.com      # Your MQTT broker address
MQTT_PORT=1883                         # MQTT port (usually 1883)
MQTT_TOPIC=/+/+/+/data                # Topic pattern to subscribe
MQTT_USERNAME=your_username            # Your MQTT username (if needed)
MQTT_PASSWORD=your_password            # Your MQTT password (if needed)
```

**Topic pattern examples:**
- `/+/+/+/data` - Matches `/home/sensors/SENSOR_001/data`
- `/home/sensors/#` - Matches everything under `/home/sensors/`
- `sensors/#` - Matches everything under `sensors/`

Save and exit (Ctrl+X, Y, Enter)

### Step 5: Start the Stack

```bash
./scripts/start.sh
```

This starts all three services:
- Graphite (database)
- Grafana (visualization)
- MQTT Bridge (data ingestion)

### Step 6: Verify Services are Running

```bash
./scripts/status.sh
```

You should see all three containers running:
```
NAME           STATUS
graphite       Up
grafana        Up
mqtt-bridge    Up
```

### Step 7: Access Grafana

Open your web browser and go to:

```
http://YOUR_RPI_IP:3000
```

**Default credentials:**
- Username: `admin`
- Password: `admin`

You'll be prompted to change the password on first login.

### Step 8: Verify Graphite Connection

In Grafana:
1. Go to **Connections** → **Data sources**
2. You should see "Graphite" already configured
3. Click on it and scroll down
4. Click **"Test"** button
5. Should show: "Data source is working"

### Step 9: Test MQTT Data Flow

Send a test message to your MQTT broker:

```bash
# Install mosquitto-clients if needed
sudo apt-get install mosquitto-clients

# Send test data
mosquitto_pub -h YOUR_MQTT_BROKER \
  -t "/home/sensors/TEST_001/data" \
  -m '{
    "Temperature": {
      "timestamp": '$(date +%s)',
      "unit": "C",
      "min": 20.0,
      "max": 25.0,
      "avg": 22.5
    }
  }'
```

### Step 10: Check MQTT Bridge Logs

Verify the bridge received and forwarded the data:

```bash
docker-compose logs mqtt-bridge
```

You should see messages like:
```
mqtt-bridge | Forwarded: home.sensors.TEST_001.data.temperature.min = 20.0
mqtt-bridge | Forwarded: home.sensors.TEST_001.data.temperature.max = 25.0
mqtt-bridge | Forwarded: home.sensors.TEST_001.data.temperature.avg = 22.5
```

### Step 11: Verify Data in Graphite

Open Graphite web interface:

```
http://YOUR_RPI_IP
```

1. Click on "Graphite Browser"
2. Expand the tree: `home` → `sensors` → `TEST_001` → `data` → `temperature`
3. You should see: `min`, `max`, `avg`
4. Click on any metric to see the graph

### Step 12: Create Grafana Dashboard

In Grafana:

1. Click **+** → **Dashboard** → **Add visualization**
2. Select **Graphite** as data source
3. In the query, type or select: `home.sensors.TEST_001.data.temperature.avg`
4. Click **Run query**
5. You should see your data!
6. Add more panels for min/max values
7. Click **Save** (disk icon) to save your dashboard

## Common Operations

### View Logs
```bash
./scripts/logs.sh

# Or specific service:
docker-compose logs -f graphite
docker-compose logs -f grafana
docker-compose logs -f mqtt-bridge
```

### Stop Services
```bash
./scripts/stop.sh
```

### Start Services
```bash
./scripts/start.sh
```

### Restart Services
```bash
./scripts/restart.sh
```

### Check Status
```bash
./scripts/status.sh
```

## Troubleshooting

### Services Won't Start

Check logs:
```bash
./scripts/logs.sh
```

Verify directories exist:
```bash
ls -la /opt/graphite-data
ls -la data/grafana
```

### MQTT Bridge Not Connecting

1. Check MQTT credentials in `.env`:
```bash
cat .env
```

2. Test MQTT broker connectivity:
```bash
mosquitto_sub -h YOUR_MQTT_BROKER -t test -u USERNAME -P PASSWORD
```

3. Check bridge logs:
```bash
docker-compose logs mqtt-bridge
```

### No Data Appearing in Graphite

1. Verify MQTT messages are being sent:
```bash
docker-compose logs mqtt-bridge | grep "Forwarded"
```

2. Check Graphite is receiving data:
```bash
docker exec graphite ls -la /opt/graphite/storage/whisper/
```

3. Verify topic pattern in `.env` matches your MQTT topics

### Permission Errors

Fix Graphite data permissions:
```bash
sudo chown -R $(id -u):$(id -g) /opt/graphite-data
```

Fix Grafana data permissions:
```bash
sudo chown -R 472:472 data/grafana
```

### Port Already in Use

If ports 80, 3000, or 2003 are already in use, edit `docker-compose.yml`:

```bash
nano docker-compose.yml
```

Change port mappings (e.g., `8080:80` instead of `80:80`)

## What's Next?

### Set Up Auto-Start on Boot

```bash
# Enable Docker to start on boot
sudo systemctl enable docker

# Create systemd service for the stack
sudo nano /etc/systemd/system/mqtt-graphite-grafana.service
```

Add:
```ini
[Unit]
Description=MQTT-Graphite-Grafana Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USER/workspace/mqtt-graphite-grafana-stack
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=YOUR_USER

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable mqtt-graphite-grafana.service
sudo systemctl start mqtt-graphite-grafana.service
```

### Customize Grafana Dashboards

1. Explore the pre-configured dashboard
2. Create new panels with different visualizations
3. Add alerts for monitoring thresholds
4. Export/import dashboards as JSON

### Monitor System Resources

```bash
# Check disk usage
df -h

# Check Graphite data size
du -sh /opt/graphite-data

# Check container resource usage
docker stats
```

## Success Checklist

- [ ] Repository cloned
- [ ] `config.json` reviewed/edited
- [ ] Setup script completed successfully
- [ ] `.env` file configured with MQTT credentials
- [ ] Services started and running
- [ ] Grafana accessible at port 3000
- [ ] Graphite accessible at port 80
- [ ] Test MQTT message sent
- [ ] Data visible in Graphite
- [ ] Data visible in Grafana
- [ ] Dashboard created

## Support

If you encounter issues:

1. Check logs: `./scripts/logs.sh`
2. Verify configuration files: `config.json` and `.env`
3. Review the main [README.md](README.md) for detailed documentation
4. Check Docker status: `docker ps -a`

---

**Congratulations!** Your MQTT-Graphite-Grafana monitoring stack is now running! 🎉
