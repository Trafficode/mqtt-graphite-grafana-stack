#!/usr/bin/env python3
"""
Test script for MQTT Bridge
Simulates sensor data publishing to test the bridge functionality
"""

import json
import time
import paho.mqtt.client as mqtt

# MQTT Configuration
MQTT_BROKER = "localhost"  # Change to your MQTT broker
MQTT_PORT = 1883
MQTT_TOPIC = "/home/sensors/ESP32_TEST01/data"

# Sample sensor data
sensor_data = {
    "Temperature": {
        "timestamp": int(time.time()),
        "unit": "C",
        "min": 18.5,
        "max": 24.3,
        "avg": 21.4
    },
    "Humidity": {
        "timestamp": int(time.time()),
        "unit": "%",
        "min": 52.0,
        "max": 68.5,
        "avg": 60.2
    },
    "Pressure": {
        "timestamp": int(time.time()),
        "unit": "hPa",
        "min": 1010.2,
        "max": 1012.8,
        "avg": 1011.5
    }
}

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
    else:
        print(f"Connection failed with code {rc}")

def on_publish(client, userdata, mid):
    print(f"Message published successfully (mid: {mid})")

# Create MQTT client
client = mqtt.Client()
client.on_connect = on_connect
client.on_publish = on_publish

try:
    # Connect to broker
    print(f"Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    
    # Wait for connection
    time.sleep(1)
    
    # Publish test data
    payload = json.dumps(sensor_data, indent=2)
    print(f"\nPublishing to topic: {MQTT_TOPIC}")
    print(f"Payload:\n{payload}\n")
    
    result = client.publish(MQTT_TOPIC, payload)
    
    # Wait for publish to complete
    time.sleep(1)
    
    print("\nExpected Graphite metrics:")
    print("  home.sensors.ESP32_TEST01.Temperature.min 18.5")
    print("  home.sensors.ESP32_TEST01.Temperature.max 24.3")
    print("  home.sensors.ESP32_TEST01.Temperature.avg 21.4")
    print("  home.sensors.ESP32_TEST01.Humidity.min 52.0")
    print("  home.sensors.ESP32_TEST01.Humidity.max 68.5")
    print("  home.sensors.ESP32_TEST01.Humidity.avg 60.2")
    print("  home.sensors.ESP32_TEST01.Pressure.min 1010.2")
    print("  home.sensors.ESP32_TEST01.Pressure.max 1012.8")
    print("  home.sensors.ESP32_TEST01.Pressure.avg 1011.5")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    client.loop_stop()
    client.disconnect()
    print("\nTest complete!")
