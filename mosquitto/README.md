# Mosquitto MQTT Broker Setup

## Overview

Mosquitto MQTT broker installed directly on Raspberry Pi for low overhead and better performance.

**Version**: 2.0.21  
**Compatibility**: Configured to behave like version 1.5.7 (anonymous access enabled)

## Installation

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients
```

## Configuration

### Main Configuration
Location: `/etc/mosquitto/mosquitto.conf`

```conf
# Place your local configuration in /etc/mosquitto/conf.d/
#
# A full description of the configuration file is at
# /usr/share/doc/mosquitto/examples/mosquitto.conf

#pid_file /run/mosquitto/mosquitto.pid

persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

include_dir /etc/mosquitto/conf.d
```

### Local Configuration
Location: `/etc/mosquitto/conf.d/local.conf`

```conf
# Listen on all interfaces on port 1883 (same as 1.5.7 default)
listener 1883

# Allow anonymous connections (1.5.7 default behavior)
# This is required in Mosquitto 2.x, but was default in 1.5.7
allow_anonymous true
```

## Service Management

### Start/Stop/Restart
```bash
sudo systemctl start mosquitto
sudo systemctl stop mosquitto
sudo systemctl restart mosquitto
```

### Status Check
```bash
sudo systemctl status mosquitto
```

### Enable Auto-Start on Boot
```bash
sudo systemctl enable mosquitto
```

### View Logs
```bash
# Live logs
sudo journalctl -u mosquitto -f

# Last 50 lines
sudo journalctl -u mosquitto -n 50

# Log file
sudo tail -f /var/log/mosquitto/mosquitto.log
```

## Testing

### Check if listening on port 1883
```bash
ss -tlnp | grep 1883
```

Expected output:
```
LISTEN 0      100          0.0.0.0:1883       0.0.0.0:*
LISTEN 0      100             [::]:1883          [::]:*
```

### Test publish/subscribe
```bash
# Terminal 1 - Subscribe to test topic
mosquitto_sub -h localhost -t test/topic -v

# Terminal 2 - Publish message
mosquitto_pub -h localhost -t test/topic -m "Hello MQTT"
```

### Check broker version
```bash
mosquitto_sub -t '$SYS/broker/version' -C 1 -h localhost
```

### Test from remote machine
```bash
mosquitto_pub -h 192.168.1.11 -t test/topic -m "Remote test"
```

## Network Access

The broker is configured to listen on all network interfaces (0.0.0.0:1883).

**Local access**: `localhost:1883`  
**Network access**: `<raspberry-pi-ip>:1883`

Get your IP:
```bash
hostname -I
```

## Security Notes

⚠️ **Current setup allows anonymous connections** - compatible with your existing 1.5.7 setup.

For production environments, consider:

### Enable authentication
```bash
# Create password file
sudo mosquitto_passwd -c /etc/mosquitto/passwd username

# Update /etc/mosquitto/conf.d/local.conf
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd
```

### Enable TLS/SSL
```conf
listener 8883
cafile /etc/mosquitto/ca_certificates/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key
```

## Integration with Existing Setup

Your MQTT bridge and devices are currently connected to `194.42.111.14:1883`.

To migrate to local Mosquitto:

1. **Update MQTT bridge configuration**:
   ```bash
   nano /home/kku/workspace/mqtt-graphite-grafana-stack/config.json
   ```
   Change:
   ```json
   "mqtt": {
     "broker": "localhost",
     "port": 1883,
     ...
   }
   ```

2. **Restart MQTT bridge**:
   ```bash
   sudo systemctl restart mqtt-graphite-bridge.service
   ```

3. **Configure devices** to publish to new broker IP (192.168.1.11:1883)

## Topics in Use

Current setup uses these topics:

- `wlab/graphite/+/data` - New JSON format devices (e.g., GRROD)
- `/wlabdb/bin` - Legacy binary format (RODOS)
- `/wlabdb` - Legacy JSON format (MAKRO)

Monitor all topics:
```bash
mosquitto_sub -h localhost -t '#' -v
```

Monitor specific topic:
```bash
# Watch GRROD data
mosquitto_sub -h localhost -t 'wlab/graphite/2CCF67F123B6/data' -v

# Watch legacy binary
mosquitto_sub -h localhost -t '/wlabdb/bin' -v

# Watch legacy JSON
mosquitto_sub -h localhost -t '/wlabdb' -v
```

## Retained Messages

Clear retained message from topic:
```bash
mosquitto_pub -h localhost -t topic/path -r -n
```

Clear all retained messages (use with caution):
```bash
mosquitto_sub -h localhost -t '#' -v --retained-only | \
  grep -oP '(?<=^)[^ ]+' | \
  xargs -I {} mosquitto_pub -h localhost -t {} -r -n
```

## Performance

**Memory usage**: ~5-10 MB  
**CPU usage**: Minimal (<1%)  
**Latency**: <1ms local, ~5-10ms network

Much lower overhead compared to Docker deployment (~50-100 MB).

## Troubleshooting

### Broker not starting
```bash
# Check config syntax
mosquitto -c /etc/mosquitto/mosquitto.conf -v

# Check logs
sudo journalctl -u mosquitto -n 50
```

### Connection refused
```bash
# Verify listening
ss -tlnp | grep 1883

# Check firewall (if enabled)
sudo ufw status
sudo ufw allow 1883/tcp
```

### Clients can't connect
```bash
# Test from broker host
mosquitto_sub -h localhost -t test -v

# Test from remote
mosquitto_sub -h <raspberry-pi-ip> -t test -v
```

## Files and Directories

- **Config**: `/etc/mosquitto/mosquitto.conf`
- **Local config**: `/etc/mosquitto/conf.d/local.conf`
- **Logs**: `/var/log/mosquitto/mosquitto.log`
- **Data**: `/var/lib/mosquitto/` (persistence)
- **Service**: `/usr/lib/systemd/system/mosquitto.service`

## Backup

### Backup configuration
```bash
sudo cp /etc/mosquitto/mosquitto.conf /etc/mosquitto/mosquitto.conf.backup
sudo cp /etc/mosquitto/conf.d/local.conf /etc/mosquitto/conf.d/local.conf.backup
```

### Backup persistent data
```bash
sudo tar -czf mosquitto-backup.tar.gz /var/lib/mosquitto/
```

## References

- Official documentation: https://mosquitto.org/documentation/
- Man pages: `man mosquitto.conf`, `man mosquitto`
- Config examples: `/usr/share/doc/mosquitto/examples/`
