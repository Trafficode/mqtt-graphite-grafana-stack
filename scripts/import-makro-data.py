#!/usr/bin/env python3
"""
Import historical MAKRO data from old file-based database into Graphite
"""

import json
import socket
import time
from pathlib import Path

GRAPHITE_HOST = 'localhost'
GRAPHITE_PORT = 2003
DEVICE_UID = '48E729C88B0C'
DEVICE_NAME = 'MAKRO'
OLD_DB_PATH = f'/mnt/nvme/tmp/database/{DEVICE_UID}'

def send_to_graphite(metrics):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.connect((GRAPHITE_HOST, GRAPHITE_PORT))
        for metric_path, value, timestamp in metrics:
            message = f"{metric_path} {value} {timestamp}\n"
            sock.sendall(message.encode('utf-8'))
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        sock.close()

def import_serie(serie_name):
    """Import Temperature or Humidity data"""
    serie_path = Path(OLD_DB_PATH) / serie_name / '2025' / '11'
    
    if not serie_path.exists():
        print(f"Path not found: {serie_path}")
        return 0
    
    json_files = sorted(serie_path.glob('*.json'), key=lambda x: int(x.stem))
    total = 0
    
    print(f"\nImporting {serie_name} for {DEVICE_NAME}...")
    
    for json_file in json_files:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        metrics = []
        base_path = f"monitoring_data.{DEVICE_NAME}_{DEVICE_UID}.{serie_name}"
        
        for timestamp_str, values in data.items():
            if not timestamp_str.isdigit():
                continue
            
            ts = int(timestamp_str)
            
            if 'f_min' in values and 'i_min_ts' in values:
                metrics.append((f"{base_path}.min", values['f_min'], values['i_min_ts']))
            
            if 'f_max' in values and 'i_max_ts' in values:
                metrics.append((f"{base_path}.max", values['f_max'], values['i_max_ts']))
            
            if 'f_avg' in values:
                metrics.append((f"{base_path}.avg", values['f_avg'], ts))
        
        if metrics:
            send_to_graphite(metrics)
            total += len(metrics)
        
        time.sleep(0.05)
    
    return total

if __name__ == '__main__':
    temp_count = import_serie('Temperature')
    print(f"Imported {temp_count} Temperature metrics")
    
    hum_count = import_serie('Humidity')
    print(f"Imported {hum_count} Humidity metrics")
    
    print(f"\nTotal: {temp_count + hum_count} metrics")
