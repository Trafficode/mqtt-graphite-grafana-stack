#!/usr/bin/env python3
"""
MQTT to Graphite Bridge
Subscribes to MQTT topics and forwards metrics to Graphite
"""

import os
import sys
import time
import json
import socket
import logging
import signal
import struct
from datetime import datetime
from typing import Optional, Dict, Any

import paho.mqtt.client as mqtt
import yaml

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GraphiteClient:
    """Client for sending metrics to Graphite"""
    
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.socket = None
        
    def connect(self) -> bool:
        """Establish connection to Graphite"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            logger.info(f"Connected to Graphite at {self.host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Graphite: {e}")
            return False
    
    def send_metric(self, metric_path: str, value: float, timestamp: Optional[int] = None) -> bool:
        """Send a metric to Graphite"""
        if timestamp is None:
            timestamp = int(time.time())
        
        message = f"{metric_path} {value} {timestamp}\n"
        
        try:
            if not self.socket:
                if not self.connect():
                    return False
            
            self.socket.sendall(message.encode('utf-8'))
            logger.debug(f"Sent metric: {message.strip()}")
            return True
        except Exception as e:
            logger.error(f"Failed to send metric: {e}")
            self.socket = None
            return False
    
    def close(self):
        """Close connection to Graphite"""
        if self.socket:
            self.socket.close()
            self.socket = None


class MQTTBridge:
    """Bridge MQTT messages to Graphite metrics"""
    
    # Known legacy device names (UID -> Name mapping)
    LEGACY_DEVICES = {
        '110020FF0001': 'Rodos',
        '31AB0F224FDC': 'Zlocien',
        '48E729C88B0C': 'Makro',
        'A020A61259E8': 'Krakers',
        'F1AB0F224FDC': 'Unknown'
    }
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.graphite = GraphiteClient(
            config['graphite']['host'],
            config['graphite']['port']
        )
        self.mqtt_client = mqtt.Client()
        self.running = True
        
        # Get topic prefix and pattern
        self.topic_prefix = config['mqtt'].get('topic_prefix', '')
        self.topic_pattern = config['mqtt'].get('topic', '+/data')
        
        # Build full subscription topics
        if self.topic_prefix:
            self.full_topic = f"{self.topic_prefix}/{self.topic_pattern}"
        else:
            self.full_topic = self.topic_pattern
        
        # Legacy binary topic is always constant (no prefix)
        self.legacy_bin_topic = "/wlabdb/bin"
        
        # Set up MQTT callbacks
        self.mqtt_client.on_connect = self.on_connect
        self.mqtt_client.on_message = self.on_message
        self.mqtt_client.on_disconnect = self.on_disconnect
        
        # Set up MQTT authentication if provided
        if config['mqtt'].get('username') and config['mqtt'].get('password'):
            self.mqtt_client.username_pw_set(
                config['mqtt']['username'],
                config['mqtt']['password']
            )
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback when connected to MQTT broker"""
        if rc == 0:
            logger.info("Connected to MQTT broker")
            client.subscribe(self.full_topic)
            logger.info(f"Subscribed to topic: {self.full_topic}")
            # Subscribe to legacy binary topic
            client.subscribe(self.legacy_bin_topic)
            logger.info(f"Subscribed to legacy topic: {self.legacy_bin_topic}")
        else:
            logger.error(f"Failed to connect to MQTT broker, return code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback when disconnected from MQTT broker"""
        if rc != 0:
            logger.warning(f"Unexpected MQTT disconnect, return code: {rc}")
    
    def on_message(self, client, userdata, msg):
        """Callback when message received from MQTT"""
        try:
            topic = msg.topic
            
            # Check if this is a legacy binary message
            if topic == self.legacy_bin_topic:
                self.parse_legacy_binary(msg.payload)
                return
            
            payload = msg.payload.decode('utf-8')
            
            logger.debug(f"Received message on {topic}: {payload}")
            
            # Parse the message
            metric_path, value = self.parse_message(topic, payload)
            
            # If parse_message returns values, send them
            # Otherwise, metrics were already sent inside parse_message
            if metric_path and value is not None:
                # Send to Graphite
                self.graphite.send_metric(metric_path, value)
                logger.info(f"Forwarded: {metric_path} = {value}")
                
        except Exception as e:
            logger.error(f"Error processing message from {topic}: {e}", exc_info=True)
    
    def parse_legacy_binary(self, payload: bytes):
        """
        Parse legacy binary format from old devices
        
        Binary format (37 bytes per sample):
        - byte 0: version + sample count
        - bytes 1-6: device UID (6 bytes, reversed)
        - bytes 7-14: timestamp (int64, little-endian)
        - bytes 15-16: temp_act (int16, little-endian, value*10)
        - bytes 17-18: temp_avg (int16, little-endian, value*10)
        - bytes 19-20: temp_max (int16, little-endian, value*10)
        - bytes 21-22: temp_min (int16, little-endian, value*10)
        - bytes 23-24: temp_max_ts_offset (int16, little-endian)
        - bytes 25-26: temp_min_ts_offset (int16, little-endian)
        - byte 27: humidity_act (uint8)
        - byte 28: humidity_avg (uint8)
        - byte 29: humidity_max (uint8)
        - byte 30: humidity_min (uint8)
        - bytes 31-32: humidity_max_ts_offset (int16, little-endian)
        - bytes 33-34: humidity_min_ts_offset (int16, little-endian)
        - bytes 35-36: battery_voltage (int16, little-endian)
        """
        try:
            # Extract number of samples in this packet
            samples_n = 1 + (payload[0] >> 5)
            offset = 0
            version1_len = 37
            
            for _ in range(samples_n):
                if offset + version1_len > len(payload):
                    logger.warning(f"Incomplete binary packet, skipping remaining samples")
                    break
                
                packet = payload[offset:offset + version1_len]
                
                # Parse binary packet
                uid = "%02X%02X%02X%02X%02X%02X" % (packet[6], packet[5], packet[4], packet[3], packet[2], packet[1])
                ts = int(struct.unpack('<q', packet[7:15])[0])
                
                # Temperature (divide by 10)
                temp_act = struct.unpack('<h', packet[15:17])[0] / 10.0
                temp_avg = struct.unpack('<h', packet[17:19])[0] / 10.0
                temp_max = struct.unpack('<h', packet[19:21])[0] / 10.0
                temp_min = struct.unpack('<h', packet[21:23])[0] / 10.0
                temp_max_ts_offset = struct.unpack('<h', packet[23:25])[0]
                temp_min_ts_offset = struct.unpack('<h', packet[25:27])[0]
                
                # Humidity (no division)
                hum_act = packet[27]
                hum_avg = packet[28]
                hum_max = packet[29]
                hum_min = packet[30]
                hum_max_ts_offset = struct.unpack('<h', packet[31:33])[0]
                hum_min_ts_offset = struct.unpack('<h', packet[33:35])[0]
                
                # Get device name from known devices
                device_name = self.LEGACY_DEVICES.get(uid, uid)
                sensor_key = f"{device_name.upper()}_{uid}"
                base_path = f"monitoring_data.{sensor_key}"
                
                # Send Temperature metrics
                self.graphite.send_metric(f"{base_path}.Temperature.min", temp_min, ts + temp_min_ts_offset)
                self.graphite.send_metric(f"{base_path}.Temperature.max", temp_max, ts + temp_max_ts_offset)
                self.graphite.send_metric(f"{base_path}.Temperature.avg", temp_avg, ts)
                
                # Send Humidity metrics
                self.graphite.send_metric(f"{base_path}.Humidity.min", float(hum_min), ts + hum_min_ts_offset)
                self.graphite.send_metric(f"{base_path}.Humidity.max", float(hum_max), ts + hum_max_ts_offset)
                self.graphite.send_metric(f"{base_path}.Humidity.avg", float(hum_avg), ts)
                
                logger.info(f"Forwarded legacy binary data from {device_name} ({uid}): 6 metrics")
                
                offset += version1_len
                
        except Exception as e:
            logger.error(f"Error parsing legacy binary message: {e}", exc_info=True)
    
    def parse_message(self, topic: str, payload: str) -> tuple:
        """
        Parse MQTT message and convert to Graphite metric
        
        Topic format: {topic_prefix}/SENSOR_UID/data
        Example: sensors/home/BEDROOM_001/data
        
        Expected JSON format with optional sensor_name:
        {
          "sensor_name": "Bedroom Sensor",  # Optional friendly name
          "Temperature": {
            "ts": 1234567890,         # Main timestamp in UTC (optional, defaults to now)
            "unit": "C",
            "min": 12.9,
            "min_ts": 1234567800,     # Timestamp when min occurred in UTC (REQUIRED)
            "max": 44.1,
            "max_ts": 1234567850,     # Timestamp when max occurred in UTC (REQUIRED)
            "avg": 22.9
          },
          "Humidity": {
            "ts": 1234567890,
            "unit": "%",
            "min": 45.0,
            "min_ts": 1234567800,     # REQUIRED
            "max": 75.0,
            "max_ts": 1234567850,     # REQUIRED
            "avg": 60.5
          }
        }
        
        All timestamps must be in UTC (Unix epoch seconds).
        min_ts and max_ts are REQUIRED when min/max values are present.
        
        Creates metrics like: sensors.home.BEDROOM_001.Temperature.min
        With sensor_name, also creates: sensors.home.bedroom_sensor.Temperature.min
        """
        # Remove topic prefix if present to extract UID
        topic_clean = topic
        if self.topic_prefix:
            topic_clean = topic.replace(self.topic_prefix, '', 1).lstrip('/')
        
        # Extract sensor UID from topic path
        # Expected format: SENSOR_UID/data
        parts = [p for p in topic_clean.split('/') if p]
        
        # Look for 'data' suffix and extract sensor UID
        if len(parts) >= 2 and parts[-1] == 'data':
            sensor_uid = parts[-2]
        elif len(parts) >= 1:
            sensor_uid = parts[0]
        else:
            sensor_uid = 'unknown'
        
        # Build base path with topic prefix
        if self.topic_prefix:
            base_path = self.topic_prefix.replace('/', '.') + '.' + sensor_uid
        else:
            base_path = sensor_uid
        
        # Try parsing as JSON
        try:
            data = json.loads(payload)
            if isinstance(data, dict):
                metrics_sent = 0
                sensor_name_friendly = None
                
                # Check for optional sensor_name field
                if 'sensor_name' in data:
                    sensor_name_friendly = data['sensor_name'].replace(' ', '_').lower()
                    logger.info(f"Sensor {sensor_uid} identified as: {data['sensor_name']}")
                
                # Remove metadata fields from data dict so they're not processed as metrics
                data = {k: v for k, v in data.items() if k != 'sensor_name'}
                
                # Process each sensor type (Temperature, Humidity, etc.)
                for sensor_type, sensor_data in data.items():
                    if not isinstance(sensor_data, dict):
                        continue
                    
                    # Statistics format - send min, max, avg as separate metrics
                    if any(k in sensor_data for k in ['min', 'max', 'avg']):
                        # Get main timestamp (defaults to current time if not provided)
                        timestamp = sensor_data.get('ts', int(time.time()))
                        
                        # Sanitize sensor type name
                        sensor_key = sensor_type.replace(' ', '_')
                        
                        # Send metrics with UID - use specific timestamps (required for min/max)
                        for stat_type in ['min', 'max', 'avg']:
                            if stat_type in sensor_data:
                                metric_path = f"{base_path}.{sensor_key}.{stat_type}"
                                value = float(sensor_data[stat_type])
                                # Use specific timestamp for min/max (required), otherwise use main timestamp
                                stat_ts = sensor_data.get(f'{stat_type}_ts', timestamp)
                                self.graphite.send_metric(metric_path, value, stat_ts)
                                logger.info(f"Forwarded: {metric_path} = {value} @ {stat_ts}")
                                metrics_sent += 1
                        
                        # Also send with friendly name if provided
                        if sensor_name_friendly:
                            base_friendly = self.topic_prefix.replace('/', '.') + '.' + sensor_name_friendly if self.topic_prefix else sensor_name_friendly
                            for stat_type in ['min', 'max', 'avg']:
                                if stat_type in sensor_data:
                                    metric_path = f"{base_friendly}.{sensor_key}.{stat_type}"
                                    value = float(sensor_data[stat_type])
                                    stat_ts = sensor_data.get(f'{stat_type}_ts', timestamp)
                                    self.graphite.send_metric(metric_path, value, stat_ts)
                                    logger.debug(f"Forwarded (friendly): {metric_path} = {value} @ {stat_ts}")
                                    metrics_sent += 1
                    
                    elif isinstance(sensor_data, (int, float)):
                        # Simple key-value format
                        sensor_key = sensor_type.replace(' ', '_')
                        metric_path = f"{base_path}.{sensor_key}"
                        self.graphite.send_metric(metric_path, float(sensor_data))
                        logger.info(f"Forwarded: {metric_path} = {sensor_data}")
                        metrics_sent += 1
                
                if metrics_sent > 0:
                    display_name = f"{sensor_name_friendly} ({sensor_uid})" if sensor_name_friendly else sensor_uid
                    logger.info(f"Sent {metrics_sent} metrics from sensor {display_name}")
                
                return None, None  # Already sent metrics
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
            return None, None
    
    def start(self):
        """Start the bridge"""
        logger.info("Starting MQTT to Graphite bridge")
        
        # Connect to Graphite
        if not self.graphite.connect():
            logger.error("Failed to connect to Graphite, exiting")
            return
        
        # Connect to MQTT broker
        try:
            self.mqtt_client.connect(
                self.config['mqtt']['broker'],
                self.config['mqtt']['port'],
                60
            )
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            return
        
        # Start MQTT loop
        self.mqtt_client.loop_start()
        
        # Keep running until interrupted
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the bridge"""
        logger.info("Stopping MQTT to Graphite bridge")
        self.running = False
        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()
        self.graphite.close()


def load_config(config_file: str = '/app/config.yml') -> Dict[str, Any]:
    """Load configuration from file or environment"""
    config = {
        'mqtt': {
            'broker': os.getenv('MQTT_BROKER', 'localhost'),
            'port': int(os.getenv('MQTT_PORT', 1883)),
            'topic_prefix': os.getenv('MQTT_TOPIC_PREFIX', ''),
            'topic': os.getenv('MQTT_TOPIC', '+/data'),
            'username': os.getenv('MQTT_USERNAME', ''),
            'password': os.getenv('MQTT_PASSWORD', '')
        },
        'graphite': {
            'host': os.getenv('GRAPHITE_HOST', 'localhost'),
            'port': int(os.getenv('GRAPHITE_PORT', 2003))
        }
    }
    
    # Try loading from config file if it exists
    try:
        with open(config_file, 'r') as f:
            file_config = yaml.safe_load(f)
            if file_config:
                # Merge file config with environment config (env takes precedence)
                for section in ['mqtt', 'graphite']:
                    if section in file_config:
                        for key, value in file_config[section].items():
                            env_key = f"{section.upper()}_{key.upper()}"
                            # Only use file config if no environment variable is set
                            if key not in config[section] or (env_key not in os.environ and not config[section][key]):
                                config[section][key] = value
    except FileNotFoundError:
        logger.info(f"Config file {config_file} not found, using environment variables")
    except Exception as e:
        logger.warning(f"Error loading config file: {e}")
    
    return config


def main():
    """Main entry point"""
    config = load_config()
    
    # Build full topic for display
    topic_prefix = config['mqtt'].get('topic_prefix', '')
    topic_pattern = config['mqtt'].get('topic', '+/data')
    full_topic = f"{topic_prefix}/{topic_pattern}" if topic_prefix else topic_pattern
    
    logger.info("Configuration:")
    logger.info(f"  MQTT Broker: {config['mqtt']['broker']}:{config['mqtt']['port']}")
    logger.info(f"  MQTT Topic: {full_topic}")
    if topic_prefix:
        logger.info(f"  Topic Prefix: {topic_prefix}")
    logger.info(f"  Graphite: {config['graphite']['host']}:{config['graphite']['port']}")
    
    bridge = MQTTBridge(config)
    
    # Handle signals for graceful shutdown
    def signal_handler(sig, frame):
        bridge.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    bridge.start()


if __name__ == '__main__':
    main()
