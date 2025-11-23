#!/usr/bin/env python3
#
# MQTT-Graphite-Grafana Stack - Legacy Database Import Script
# Copyright (C) 2025 Trafficode
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

"""
Import legacy database format to Graphite

This script converts data from the old JSON database format to Graphite metrics.
The legacy format stores data in files like:
  database/UID/desc.json
  database/UID/Temperature/YYYY/MM/DD.json
  database/UID/Humidity/YYYY/MM/DD.json

Each data point contains:
  "timestamp": {
    "f_max": value, "i_max_ts": timestamp,
    "f_min": value, "i_min_ts": timestamp,
    "f_avg": value
  }
"""

import os
import sys
import json
import socket
import argparse
from pathlib import Path
from typing import Dict, Any, Optional


class GraphiteClient:
    """Client for sending metrics to Graphite"""
    
    def __init__(self, host: str = 'localhost', port: int = 2003):
        self.host = host
        self.port = port
        self.socket = None
        
    def connect(self) -> bool:
        """Establish connection to Graphite"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.connect((self.host, self.port))
            print(f"✓ Connected to Graphite at {self.host}:{self.port}")
            return True
        except Exception as e:
            print(f"✗ Failed to connect to Graphite: {e}")
            return False
    
    def send_metric(self, metric_path: str, value: float, timestamp: int) -> bool:
        """Send a metric to Graphite"""
        message = f"{metric_path} {value} {timestamp}\n"
        
        try:
            if not self.socket:
                if not self.connect():
                    return False
            
            self.socket.sendall(message.encode('utf-8'))
            return True
        except Exception as e:
            print(f"✗ Failed to send metric: {e}")
            self.socket = None
            return False
    
    def close(self):
        """Close connection to Graphite"""
        if self.socket:
            self.socket.close()
            self.socket = None


class LegacyDatabaseImporter:
    """Import legacy database to Graphite"""
    
    def __init__(self, database_path: str, graphite_host: str = 'localhost', graphite_port: int = 2003):
        self.database_path = Path(database_path)
        self.graphite = GraphiteClient(graphite_host, graphite_port)
        self.metrics_sent = 0
        self.errors = 0
        
    def load_device_info(self, uid: str) -> Optional[Dict[str, Any]]:
        """Load device description"""
        desc_file = self.database_path / uid / "desc.json"
        if not desc_file.exists():
            print(f"✗ Device description not found: {desc_file}")
            return None
        
        try:
            with open(desc_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"✗ Failed to load device info: {e}")
            return None
    
    def import_device_data(self, uid: str) -> bool:
        """Import all data for a specific device UID"""
        device_path = self.database_path / uid
        
        if not device_path.exists():
            print(f"✗ Device directory not found: {device_path}")
            return False
        
        # Load device description
        device_info = self.load_device_info(uid)
        if not device_info:
            return False
        
        sensor_name = device_info.get('name', uid)
        series = device_info.get('serie', {})
        
        print(f"\n=== Importing data for {sensor_name} ({uid}) ===")
        print(f"Series: {', '.join(series.keys())}")
        
        # Connect to Graphite
        if not self.graphite.connect():
            return False
        
        # Process each series (Temperature, Humidity, etc.)
        for serie_name in series.keys():
            serie_path = device_path / serie_name
            if not serie_path.exists():
                print(f"  ⚠ Series directory not found: {serie_name}")
                continue
            
            print(f"\n  Processing {serie_name}...")
            self._import_serie(uid, sensor_name, serie_name, serie_path)
        
        self.graphite.close()
        
        print(f"\n=== Import Summary ===")
        print(f"✓ Metrics sent: {self.metrics_sent}")
        if self.errors > 0:
            print(f"✗ Errors: {self.errors}")
        
        return True
    
    def _import_serie(self, uid: str, sensor_name: str, serie_name: str, serie_path: Path):
        """Import all data for a specific series"""
        # Build single metric path combining sensor name and UID
        sensor_key = f"{sensor_name.replace(' ', '_').upper()}_{uid}"
        base_path = f"monitoring_data.{sensor_key}.{serie_name}"
        
        # Find all JSON files recursively
        json_files = sorted(serie_path.glob("**/*.json"))
        
        if not json_files:
            print(f"    ⚠ No data files found in {serie_name}")
            return
        
        print(f"    Found {len(json_files)} data files")
        
        total_points = 0
        
        for json_file in json_files:
            try:
                with open(json_file, 'r') as f:
                    data = json.load(f)
                
                # Process each timestamp entry (skip 'general' entry)
                for timestamp_key, values in data.items():
                    if timestamp_key == 'general' or not isinstance(values, dict):
                        continue
                    
                    # Extract values
                    f_min = values.get('f_min')
                    f_max = values.get('f_max')
                    f_avg = values.get('f_avg')
                    i_min_ts = values.get('i_min_ts')
                    i_max_ts = values.get('i_max_ts')
                    
                    # Validate required fields
                    if f_min is None or f_max is None or f_avg is None:
                        continue
                    if i_min_ts is None or i_max_ts is None:
                        continue
                    
                    # Send metrics with combined name
                    self.graphite.send_metric(f"{base_path}.min", float(f_min), int(i_min_ts))
                    self.graphite.send_metric(f"{base_path}.max", float(f_max), int(i_max_ts))
                    self.graphite.send_metric(f"{base_path}.avg", float(f_avg), int(timestamp_key))
                    
                    self.metrics_sent += 3
                    total_points += 1
                
            except Exception as e:
                print(f"    ✗ Error processing {json_file}: {e}")
                self.errors += 1
        
        print(f"    ✓ Imported {total_points} data points ({self.metrics_sent} metrics)")


def main():
    parser = argparse.ArgumentParser(
        description='Import legacy database to Graphite',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Import single device
  %(prog)s --database /mnt/nvme/tmp/database --uid 110020FF0001

  # Import with custom Graphite host
  %(prog)s --database /mnt/nvme/tmp/database --uid 110020FF0001 --graphite-host 192.168.1.100
        """
    )
    
    parser.add_argument('--database', '-d', required=True,
                        help='Path to legacy database directory')
    parser.add_argument('--uid', '-u', required=True,
                        help='Device UID to import (directory name)')
    parser.add_argument('--graphite-host', default='localhost',
                        help='Graphite host (default: localhost)')
    parser.add_argument('--graphite-port', type=int, default=2003,
                        help='Graphite port (default: 2003)')
    
    args = parser.parse_args()
    
    # Validate database path
    db_path = Path(args.database)
    if not db_path.exists():
        print(f"✗ Database directory not found: {args.database}")
        sys.exit(1)
    
    # Create importer and run
    importer = LegacyDatabaseImporter(
        args.database,
        args.graphite_host,
        args.graphite_port
    )
    
    success = importer.import_device_data(args.uid)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
