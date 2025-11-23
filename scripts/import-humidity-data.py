#!/usr/bin/env python3
"""
Import historical Humidity data from old file-based database into Graphite
"""

import json
import socket
import time
from pathlib import Path

# Graphite configuration
GRAPHITE_HOST = 'localhost'
GRAPHITE_PORT = 2003

# Old database path
OLD_DB_PATH = '/mnt/nvme/tmp/database/110020FF0001/Humidity/2025/11'

def send_to_graphite(metrics):
    """Send metrics to Graphite via plaintext protocol"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.connect((GRAPHITE_HOST, GRAPHITE_PORT))
        
        for metric_path, value, timestamp in metrics:
            message = f"{metric_path} {value} {timestamp}\n"
            sock.sendall(message.encode('utf-8'))
            
        print(f"Sent {len(metrics)} metrics to Graphite")
        return True
    except Exception as e:
        print(f"Error sending to Graphite: {e}")
        return False
    finally:
        sock.close()

def import_day(day_file):
    """Import data from a single day file"""
    print(f"Importing {day_file.name}...")
    
    with open(day_file, 'r') as f:
        data = json.load(f)
    
    metrics = []
    base_path = "monitoring_data.RODOS_110020FF0001.Humidity"
    
    for timestamp_str, values in data.items():
        # Skip non-numeric keys like 'general'
        if not timestamp_str.isdigit():
            continue
        
        ts = int(timestamp_str)
        
        # Import min/max/avg values
        if 'f_min' in values and 'i_min_ts' in values:
            metrics.append((f"{base_path}.min", values['f_min'], values['i_min_ts']))
        
        if 'f_max' in values and 'i_max_ts' in values:
            metrics.append((f"{base_path}.max", values['f_max'], values['i_max_ts']))
        
        if 'f_avg' in values:
            metrics.append((f"{base_path}.avg", values['f_avg'], ts))
    
    if metrics:
        send_to_graphite(metrics)
    
    return len(metrics)

def main():
    db_path = Path(OLD_DB_PATH)
    
    if not db_path.exists():
        print(f"Database path not found: {db_path}")
        return
    
    # Get all JSON files sorted by day
    json_files = sorted(db_path.glob('*.json'), key=lambda x: int(x.stem))
    
    total_metrics = 0
    for json_file in json_files:
        count = import_day(json_file)
        total_metrics += count
        time.sleep(0.1)  # Small delay between days
    
    print(f"\nImport complete! Total metrics imported: {total_metrics}")

if __name__ == '__main__':
    main()
