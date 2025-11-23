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
        
        # Build full subscription topic
        if self.topic_prefix:
            self.full_topic = f"{self.topic_prefix}/{self.topic_pattern}"
        else:
            self.full_topic = self.topic_pattern
        
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
    
    def parse_message(self, topic: str, payload: str) -> tuple:
        """
        Parse MQTT message and convert to Graphite metric
        
        Topic format: {topic_prefix}/SENSOR_UID/data
        Example: sensors/home/BEDROOM_001/data
        
        Expected JSON format with optional sensor_name:
        {
          "sensor_name": "Bedroom Sensor",  # Optional friendly name
          "Temperature": {
            "timestamp": 1234567890,
            "unit": "C",
            "min": 12.9,
            "max": 44.1,
            "avg": 22.9
          },
          "Humidity": {
            "timestamp": 1234567890,
            "unit": "%",
            "min": 45.0,
            "max": 75.0,
            "avg": 60.5
          }
        }
        
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
                    # Remove sensor_name from data dict so it's not processed as a metric
                    data = {k: v for k, v in data.items() if k != 'sensor_name'}
                
                # Process each sensor type (Temperature, Humidity, etc.)
                for sensor_type, sensor_data in data.items():
                    if not isinstance(sensor_data, dict):
                        continue
                    
                    # Check if this is a statistics format (has min/max/avg)
                    if any(k in sensor_data for k in ['min', 'max', 'avg']):
                        # Statistics format - send min, max, avg as separate metrics
                        timestamp = sensor_data.get('timestamp', int(time.time()))
                        
                        # Sanitize sensor type name
                        sensor_key = sensor_type.replace(' ', '_')
                        
                        # Send metrics with UID
                        for stat_type in ['min', 'max', 'avg']:
                            if stat_type in sensor_data:
                                metric_path = f"{base_path}.{sensor_key}.{stat_type}"
                                value = float(sensor_data[stat_type])
                                self.graphite.send_metric(metric_path, value, timestamp)
                                logger.info(f"Forwarded: {metric_path} = {value} @ {timestamp}")
                                metrics_sent += 1
                        
                        # Also send with friendly name if provided
                        if sensor_name_friendly:
                            base_friendly = self.topic_prefix.replace('/', '.') + '.' + sensor_name_friendly if self.topic_prefix else sensor_name_friendly
                            for stat_type in ['min', 'max', 'avg']:
                                if stat_type in sensor_data:
                                    metric_path = f"{base_friendly}.{sensor_key}.{stat_type}"
                                    value = float(sensor_data[stat_type])
                                    self.graphite.send_metric(metric_path, value, timestamp)
                                    logger.debug(f"Forwarded (friendly): {metric_path} = {value}")
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
            elif isinstance(data, (int, float)):
                return base_path, float(data)
        except json.JSONDecodeError:
            pass
        
        # Try parsing as key=value
        if '=' in payload:
            try:
                key, value = payload.split('=', 1)
                return f"{base_path}.{key.strip()}", float(value.strip())
            except ValueError:
                pass
        
        # Try parsing as simple numeric value
        try:
            value = float(payload)
            return base_path, value
        except ValueError:
            pass
        
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
