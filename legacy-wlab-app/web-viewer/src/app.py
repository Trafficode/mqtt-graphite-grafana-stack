"""WLab Web Viewer - Flask app serving original UI with Graphite backend."""
import json
import logging
import os
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from urllib.parse import unquote

import requests
from flask import Flask, jsonify, render_template, request, make_response
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
# from flask_talisman import Talisman  # Disabled - incompatible with legacy UI inline scripts
from prometheus_flask_exporter import PrometheusMetrics

# Load configuration
config_path = Path(__file__).parent.parent / "config.json"
if not config_path.exists():
    config_path = Path(__file__).parent.parent / "config.example.json"

with open(config_path) as f:
    config = json.load(f)

# Setup logging
log_path = Path(config["logging"]["path"])
log_path.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=getattr(logging, config["logging"]["level"]),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_path / "wlab-viewer.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__, 
            template_folder=str(Path(__file__).parent.parent / "templates"),
            static_folder=str(Path(__file__).parent.parent / "static"))

# Production configuration
app.config['JSON_SORT_KEYS'] = False
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False

# Caching configuration
cache_config = {
    "CACHE_TYPE": "simple",
    "CACHE_DEFAULT_TIMEOUT": 60,  # 1 minute for most endpoints
    "CACHE_THRESHOLD": 500
}
app.config.update(cache_config)
cache = Cache(app)

# Rate limiting configuration
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per hour", "50 per minute"],
    storage_uri="memory://"
)

# Security headers disabled for legacy UI compatibility
# The legacy UI uses inline scripts and external CDN resources
# For production, consider using a reverse proxy (nginx) for security headers
# or refactor the UI to eliminate inline scripts

# Prometheus metrics
metrics = PrometheusMetrics(app)
metrics.info('wlab_viewer_info', 'WLab Weather Viewer', version='2.0.0-graphite')

# Graphite configuration
GRAPHITE_URL = f"{config['graphite']['protocol']}://{config['graphite']['host']}:{config['graphite']['port']}"
METRIC_PREFIX = config['graphite']['metric_prefix']
LEGACY_DEVICES = config.get('legacy_devices', {})


def query_graphite(target, from_time="-24h", until_time="now"):
    """Query Graphite render API and return datapoints."""
    try:
        params = {
            "target": target,
            "from": from_time,
            "until": until_time,
            "format": "json"
        }
        
        url = f"{GRAPHITE_URL}/render"
        logger.debug(f"Querying Graphite: {url} with {params}")
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        return response.json()
        
    except requests.RequestException as e:
        logger.error(f"Graphite query failed: {e}")
        return []


def find_metrics(query):
    """Find metrics matching a pattern."""
    try:
        url = f"{GRAPHITE_URL}/metrics/find"
        params = {"query": query, "format": "completer"}
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        return [item["path"] for item in data.get("metrics", [])]
        
    except requests.RequestException as e:
        logger.error(f"Metrics find failed: {e}")
        return []


@app.route("/")
@app.route("/index")
def index():
    """Render main page (original UI)."""
    logger.info("Serving index page")
    return render_template("index.html", title="Weatherlab")


@app.route("/health")
@limiter.exempt
def health():
    """Health check endpoint for monitoring and load balancers."""
    try:
        # Check Graphite connectivity
        response = requests.get(f"{GRAPHITE_URL}/metrics/index.json", timeout=5)
        graphite_status = "healthy" if response.status_code == 200 else "unhealthy"
    except:
        graphite_status = "unhealthy"
    
    status = {
        "status": "healthy" if graphite_status == "healthy" else "degraded",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0-graphite",
        "services": {
            "graphite": graphite_status
        }
    }
    
    return jsonify(status), 200 if status["status"] == "healthy" else 503


@app.route("/globals/version")
@cache.cached(timeout=300)
def wlabversion():
    """Version endpoint (for compatibility)."""
    logger.info("wlabversion()")
    version_data = {
        "version": "2.0.0-graphite",
        "date": "2025-11-23"
    }
    return jsonify(version_data)


@app.route("/restq/stations/desc")
@cache.cached(timeout=60)
def stations_desc():
    """Get station descriptions from Graphite metrics."""
    logger.info("stations_desc()")
    return jsonify(get_stations_desc())


def get_stations_desc():
    """Internal function to get station descriptions as dict."""
    # Find all device metrics
    metrics = find_metrics(f"{METRIC_PREFIX}.*")
    
    stations = {}
    for metric in metrics:
        parts = metric.split(".")
        if len(parts) >= 2:
            device_name_uid = parts[1]
            
            if "_" in device_name_uid:
                name, uid = device_name_uid.rsplit("_", 1)
            else:
                uid = device_name_uid
                name = LEGACY_DEVICES.get(uid, uid)
            
            if uid not in stations:
                stations[uid] = {
                    "uid": uid,
                    "name": name,
                    "series": [],
                    "timezone": "Europe/Warsaw",  # Default timezone
                    "longitude": "50.0",  # Default coordinates (Poland)
                    "latitude": "19.0"
                }
    
    # Find series for each station
    for uid, station in stations.items():
        device_name_uid = f"{station['name']}_{uid}"
        series_metrics = find_metrics(f"{METRIC_PREFIX}.{device_name_uid}.*")
        
        series_set = set()
        for metric in series_metrics:
            parts = metric.split(".")
            if len(parts) >= 3:
                serie = parts[2]
                series_set.add(serie)
        
        # Convert series list to dict with IDs (original format)
        # Temperature=1 (°C), Humidity=2 (%)
        serie_dict = {}
        if "Temperature" in series_set:
            serie_dict["Temperature"] = 1
        if "Humidity" in series_set:
            serie_dict["Humidity"] = 2
        # Add any other series found
        next_id = 3
        for serie_name in sorted(series_set):
            if serie_name not in serie_dict:
                serie_dict[serie_name] = next_id
                next_id += 1
        
        station["serie"] = serie_dict
        station["description"] = f"{station['name']} Weather Station"
    
    result = {uid: {
        "uid": uid,
        "name": info["name"],
        "serie": info["serie"],
        "description": info["description"],
        "timezone": info["timezone"],
        "longitude": float(info["longitude"]),
        "latitude": float(info["latitude"])
    } for uid, info in stations.items()}
    
    return result


@app.route("/restq/stations/newest")
def stations_newest():
    """Get newest data for all stations - shows today's min/max/avg and current value."""
    logger.info("stations_newest()")
    
    # Get all stations first
    desc_response = get_stations_desc()
    
    result = {}
    
    for uid, station_info in desc_response.items():
        name = station_info["name"]
        device_name_uid = f"{name}_{uid}"
        
        station_data = {}
        
        for serie in station_info["serie"]:
            serie_data = {}
            
            # Get today's date range
            now = datetime.now()
            today_start = datetime(now.year, now.month, now.day)
            from_ts = int(today_start.timestamp())
            
            # Query today's data for min (get minimum of all min values)
            min_data = query_graphite(
                f"{METRIC_PREFIX}.{device_name_uid}.{serie}.min",
                from_time=str(from_ts))
            if min_data and len(min_data) > 0:
                min_values = [(v, ts) for v, ts in min_data[0].get("datapoints", []) if v is not None]
                if min_values:
                    min_val, min_ts = min(min_values, key=lambda x: x[0])
                    serie_data["f_min"] = min_val
                    serie_data["i_min_ts"] = min_ts
            
            # Query today's data for max (get maximum of all max values)
            max_data = query_graphite(
                f"{METRIC_PREFIX}.{device_name_uid}.{serie}.max",
                from_time=str(from_ts))
            if max_data and len(max_data) > 0:
                max_values = [(v, ts) for v, ts in max_data[0].get("datapoints", []) if v is not None]
                if max_values:
                    max_val, max_ts = max(max_values, key=lambda x: x[0])
                    serie_data["f_max"] = max_val
                    serie_data["i_max_ts"] = max_ts
            
            # Query today's data for avg (calculate average and get latest)
            avg_data = query_graphite(
                f"{METRIC_PREFIX}.{device_name_uid}.{serie}.avg",
                from_time=str(from_ts))
            if avg_data and len(avg_data) > 0:
                avg_values = [(v, ts) for v, ts in avg_data[0].get("datapoints", []) if v is not None]
                if avg_values:
                    # Latest value for f_act
                    latest_val, latest_ts = avg_values[-1]
                    serie_data["f_act"] = latest_val
                    serie_data["i_act_ts"] = latest_ts
                    serie_data["f_avg"] = latest_val
                    serie_data["i_avg_ts"] = latest_ts
                    
                    # Calculate average for the day
                    all_avg_vals = [v for v, ts in avg_values]
                    serie_data["f_avg_buff"] = sum(all_avg_vals)
                    serie_data["i_counter"] = len(all_avg_vals)
            
            if serie_data:
                station_data[serie] = serie_data
        
        if station_data:
            result[uid] = station_data
    
    return jsonify(result)


@app.route("/restq/station/serie/daily/<path:uid_serie_date>")
def station_dailyserie(uid_serie_date):
    """Get daily data for a station/serie."""
    logger.info(f"station_dailyserie({uid_serie_date})")
    
    # URL decode the parameter
    uid_serie_date = unquote(uid_serie_date)
    param = json.loads(uid_serie_date)
    device_name_uid = param["uid"]  # May be "DEVICENAME_UID" or just "UID"
    serie_id = param["serie"]  # This is a string like "1" or "2"
    date_str = param["date"]  # Format: YYYY-MM-DD
    
    # Extract short UID from device_name_uid format (e.g., "RODOS_110020FF0001" -> "110020FF0001")
    # If contains underscore, take everything after first underscore
    uid = device_name_uid.split("_", 1)[1] if "_" in device_name_uid else device_name_uid
    
    # Find device name and convert serie ID to serie name
    desc_response = get_stations_desc()
    if uid not in desc_response:
        return jsonify({})
    
    name = desc_response[uid]["name"]
    device_name_uid = f"{name}_{uid}"
    
    # Convert serie ID (1,2) to serie name (Temperature, Humidity)
    serie_name = None
    for s_name, s_id in desc_response[uid]["serie"].items():
        if str(s_id) == str(serie_id):
            serie_name = s_name
            break
    
    if not serie_name:
        logger.warning(f"Serie ID {serie_id} not found for {uid}")
        return jsonify({})
    
    # Parse date and create time range for the day
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        from_time = int(date_obj.timestamp())
        until_time = int((date_obj + timedelta(days=1)).timestamp())
    except:
        return jsonify({})
    
    # Query all three stats separately using serie name
    min_data = query_graphite(f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.min", 
                              from_time=str(from_time), until_time=str(until_time))
    max_data = query_graphite(f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.max", 
                              from_time=str(from_time), until_time=str(until_time))
    avg_data = query_graphite(f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.avg", 
                              from_time=str(from_time), until_time=str(until_time))
    
    result = {}
    
    # Process min data
    if min_data and len(min_data) > 0:
        for value, timestamp in min_data[0].get("datapoints", []):
            if value is not None:
                ts_str = str(timestamp)
                if ts_str not in result:
                    result[ts_str] = {}
                result[ts_str]["f_min"] = value
                result[ts_str]["i_min_ts"] = timestamp
    
    # Process max data
    if max_data and len(max_data) > 0:
        for value, timestamp in max_data[0].get("datapoints", []):
            if value is not None:
                ts_str = str(timestamp)
                if ts_str not in result:
                    result[ts_str] = {}
                result[ts_str]["f_max"] = value
                result[ts_str]["i_max_ts"] = timestamp
    
    # Process avg data
    if avg_data and len(avg_data) > 0:
        for value, timestamp in avg_data[0].get("datapoints", []):
            if value is not None:
                ts_str = str(timestamp)
                if ts_str not in result:
                    result[ts_str] = {}
                result[ts_str]["f_avg"] = value
                result[ts_str]["f_act"] = value
                result[ts_str]["i_act_ts"] = timestamp
    
    # Ensure all timestamps have f_min, f_max, f_avg (fill missing with average of available)
    for ts_str, ts_data in result.items():
        # Calculate a reasonable default if any value is missing
        available_values = []
        if "f_min" in ts_data:
            available_values.append(ts_data["f_min"])
        if "f_max" in ts_data:
            available_values.append(ts_data["f_max"])
        if "f_avg" in ts_data:
            available_values.append(ts_data["f_avg"])
        
        if available_values:
            default_val = sum(available_values) / len(available_values)
            
            if "f_min" not in ts_data:
                ts_data["f_min"] = default_val
                ts_data["i_min_ts"] = int(ts_str)
            if "f_max" not in ts_data:
                ts_data["f_max"] = default_val
                ts_data["i_max_ts"] = int(ts_str)
            if "f_avg" not in ts_data:
                ts_data["f_avg"] = default_val
                ts_data["f_act"] = default_val
                ts_data["i_act_ts"] = int(ts_str)
    
    # Add general stats (min/max for the whole day)
    if result:
        all_min = []
        all_max = []
        all_avg = []
        
        for ts_data in result.values():
            if "f_min" in ts_data:
                all_min.append(ts_data["f_min"])
            if "f_max" in ts_data:
                all_max.append(ts_data["f_max"])
            if "f_avg" in ts_data:
                all_avg.append(ts_data["f_avg"])
        
        if all_min or all_max or all_avg:
            result["general"] = {}
            if all_min:
                result["general"]["f_min"] = min(all_min)
            if all_max:
                result["general"]["f_max"] = max(all_max)
            if all_avg:
                result["general"]["f_avg_buff"] = sum(all_avg)
                result["general"]["i_counter"] = len(all_avg)
    
    return jsonify(result)


@app.route("/restq/station/serie/monthly/<path:uid_serie_date>")
def station_monthlyserie(uid_serie_date):
    """Get monthly data for a station/serie - returns daily aggregates."""
    logger.info(f"station_monthlyserie({uid_serie_date})")
    
    # URL decode the parameter
    uid_serie_date = unquote(uid_serie_date)
    param = json.loads(uid_serie_date)
    device_name_uid = param["uid"]  # May be "DEVICENAME_UID" or just "UID"
    serie_id = param["serie"]  # This is a string like "1" or "2"
    date_str = param["date"]  # Format: YYYY-MM
    
    # Extract short UID from device_name_uid format (e.g., "RODOS_110020FF0001" -> "110020FF0001")
    uid = device_name_uid.split("_", 1)[1] if "_" in device_name_uid else device_name_uid
    
    # Find device name and convert serie ID to serie name
    desc_response = get_stations_desc()
    if uid not in desc_response:
        return jsonify({})
    
    name = desc_response[uid]["name"]
    device_name_uid = f"{name}_{uid}"
    
    # Convert serie ID to serie name
    serie_name = None
    for s_name, s_id in desc_response[uid]["serie"].items():
        if str(s_id) == str(serie_id):
            serie_name = s_name
            break
    
    if not serie_name:
        logger.warning(f"Serie ID {serie_id} not found for {uid}")
        return jsonify({})
    
    # Parse date and get month range
    try:
        year, month = date_str.split("-")
        date_obj = datetime(int(year), int(month), 1)
        from_time = int(date_obj.timestamp())
        
        # Next month
        if int(month) == 12:
            next_month = datetime(int(year) + 1, 1, 1)
        else:
            next_month = datetime(int(year), int(month) + 1, 1)
        until_time = int(next_month.timestamp())
    except:
        return jsonify({})
    
    # Query entire month at once with summarize by day
    min_data = query_graphite(
        f"summarize({METRIC_PREFIX}.{device_name_uid}.{serie_name}.min, '1d', 'min')",
        from_time=str(from_time), until_time=str(until_time))
    max_data = query_graphite(
        f"summarize({METRIC_PREFIX}.{device_name_uid}.{serie_name}.max, '1d', 'max')",
        from_time=str(from_time), until_time=str(until_time))
    avg_data = query_graphite(
        f"summarize({METRIC_PREFIX}.{device_name_uid}.{serie_name}.avg, '1d', 'avg')",
        from_time=str(from_time), until_time=str(until_time))
    
    # Organize by day number
    result = {}
    
    # Process min data
    if min_data and len(min_data) > 0:
        for value, timestamp in min_data[0].get("datapoints", []):
            if value is not None:
                day_dt = datetime.fromtimestamp(timestamp)
                # Only include days from the requested month
                if day_dt.year == int(year) and day_dt.month == int(month):
                    day_num = day_dt.strftime("%d")
                    if day_num not in result:
                        result[day_num] = {}
                    result[day_num]["f_min"] = value
                    result[day_num]["i_min_ts"] = timestamp
    
    # Process max data
    if max_data and len(max_data) > 0:
        for value, timestamp in max_data[0].get("datapoints", []):
            if value is not None:
                day_dt = datetime.fromtimestamp(timestamp)
                # Only include days from the requested month
                if day_dt.year == int(year) and day_dt.month == int(month):
                    day_num = day_dt.strftime("%d")
                    if day_num not in result:
                        result[day_num] = {}
                    result[day_num]["f_max"] = value
                    result[day_num]["i_max_ts"] = timestamp
    
    # Process avg data - need to get raw values to calculate f_avg_buff
    raw_avg_data = query_graphite(
        f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.avg",
        from_time=str(from_time), until_time=str(until_time))
    
    if raw_avg_data and len(raw_avg_data) > 0:
        # Group by day
        day_values = {}
        for value, timestamp in raw_avg_data[0].get("datapoints", []):
            if value is not None:
                day_dt = datetime.fromtimestamp(timestamp)
                # Only include days from the requested month
                if day_dt.year == int(year) and day_dt.month == int(month):
                    day_num = day_dt.strftime("%d")
                    if day_num not in day_values:
                        day_values[day_num] = []
                    day_values[day_num].append((value, timestamp))
        
        # Calculate f_avg_buff and i_counter for each day
        for day_num, values in day_values.items():
            if day_num not in result:
                result[day_num] = {}
            all_vals = [v for v, t in values]
            result[day_num]["f_avg_buff"] = sum(all_vals)
            result[day_num]["i_counter"] = len(all_vals)
            # Use last value as f_act
            result[day_num]["f_act"] = values[-1][0]
            result[day_num]["i_act_ts"] = values[-1][1]
    
    # Ensure all days have complete data (add defaults if missing)
    for day_num in list(result.keys()):
        day_data = result[day_num]
        if "f_avg_buff" not in day_data and "f_min" in day_data and "f_max" in day_data:
            # No avg data, use average of min and max
            avg_val = (day_data.get("f_min", 0) + day_data.get("f_max", 0)) / 2
            day_data["f_avg_buff"] = avg_val
            day_data["i_counter"] = 1
            day_data["f_act"] = avg_val
            day_data["i_act_ts"] = day_data.get("i_max_ts", 0)
    
    return jsonify(result)


@app.route("/restq/station/serie/yearly/<path:uid_serie_date>")
def station_yearlyserie(uid_serie_date):
    """Get yearly data for a station/serie."""
    logger.info(f"station_yearlyserie({uid_serie_date})")
    
    # URL decode the parameter
    uid_serie_date = unquote(uid_serie_date)
    param = json.loads(uid_serie_date)
    device_name_uid = param["uid"]  # May be "DEVICENAME_UID" or just "UID"
    serie_id = param["serie"]  # This is a string like "1" or "2"
    date_str = param["date"]  # Format: YYYY
    
    # Extract short UID from device_name_uid format (e.g., "RODOS_110020FF0001" -> "110020FF0001")
    uid = device_name_uid.split("_", 1)[1] if "_" in device_name_uid else device_name_uid
    
    # Find device name and convert serie ID to serie name
    desc_response = get_stations_desc()
    if uid not in desc_response:
        return jsonify({})
    
    name = desc_response[uid]["name"]
    device_name_uid = f"{name}_{uid}"
    
    # Convert serie ID to serie name
    serie_name = None
    for s_name, s_id in desc_response[uid]["serie"].items():
        if str(s_id) == str(serie_id):
            serie_name = s_name
            break
    
    if not serie_name:
        logger.warning(f"Serie ID {serie_id} not found for {uid}")
        return jsonify({})
    
    # Parse date and create time range for the year
    try:
        year = int(date_str)
        from_time = int(datetime(year, 1, 1).timestamp())
        until_time = int(datetime(year + 1, 1, 1).timestamp())
    except:
        return jsonify({})
    
    # Query all three stats separately
    min_data = query_graphite(f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.min", 
                              from_time=str(from_time), until_time=str(until_time))
    max_data = query_graphite(f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.max", 
                              from_time=str(from_time), until_time=str(until_time))
    avg_data = query_graphite(f"{METRIC_PREFIX}.{device_name_uid}.{serie_name}.avg", 
                              from_time=str(from_time), until_time=str(until_time))
    
    result = {}
    
    # Process min data
    if min_data and len(min_data) > 0:
        for value, timestamp in min_data[0].get("datapoints", []):
            if value is not None:
                ts_str = str(timestamp)
                if ts_str not in result:
                    result[ts_str] = {}
                result[ts_str]["f_min"] = value
                result[ts_str]["i_min_ts"] = timestamp
    
    # Process max data
    if max_data and len(max_data) > 0:
        for value, timestamp in max_data[0].get("datapoints", []):
            if value is not None:
                ts_str = str(timestamp)
                if ts_str not in result:
                    result[ts_str] = {}
                result[ts_str]["f_max"] = value
                result[ts_str]["i_max_ts"] = timestamp
    
    # Process avg data
    if avg_data and len(avg_data) > 0:
        for value, timestamp in avg_data[0].get("datapoints", []):
            if value is not None:
                ts_str = str(timestamp)
                if ts_str not in result:
                    result[ts_str] = {}
                result[ts_str]["f_avg"] = value
                result[ts_str]["f_act"] = value
                result[ts_str]["i_act_ts"] = timestamp
    
    # Aggregate data by month (frontend expects month numbers 1-12 as keys)
    monthly_aggregated = {}
    
    for ts_str, values in result.items():
        dt = datetime.fromtimestamp(int(ts_str))
        month = str(dt.month)  # 1-12
        
        if month not in monthly_aggregated:
            monthly_aggregated[month] = {
                "f_min": values.get("f_min"),
                "f_max": values.get("f_max"),
                "f_avg": values.get("f_avg"),
                "f_act": values.get("f_act"),
                "i_min_ts": values.get("i_min_ts"),
                "i_max_ts": values.get("i_max_ts"),
                "i_act_ts": values.get("i_act_ts"),
                "count": 1,
                "sum_avg": values.get("f_avg", 0)
            }
        else:
            # Update min
            if "f_min" in values:
                if monthly_aggregated[month]["f_min"] is None or values["f_min"] < monthly_aggregated[month]["f_min"]:
                    monthly_aggregated[month]["f_min"] = values["f_min"]
                    monthly_aggregated[month]["i_min_ts"] = values.get("i_min_ts")
            
            # Update max
            if "f_max" in values:
                if monthly_aggregated[month]["f_max"] is None or values["f_max"] > monthly_aggregated[month]["f_max"]:
                    monthly_aggregated[month]["f_max"] = values["f_max"]
                    monthly_aggregated[month]["i_max_ts"] = values.get("i_max_ts")
            
            # Accumulate for average
            if "f_avg" in values:
                monthly_aggregated[month]["sum_avg"] += values["f_avg"]
                monthly_aggregated[month]["count"] += 1
    
    # Calculate final averages
    for month in monthly_aggregated:
        if monthly_aggregated[month]["count"] > 0:
            monthly_aggregated[month]["f_avg"] = monthly_aggregated[month]["sum_avg"] / monthly_aggregated[month]["count"]
            monthly_aggregated[month]["f_act"] = monthly_aggregated[month]["f_avg"]
        
        # Remove temporary fields
        del monthly_aggregated[month]["count"]
        del monthly_aggregated[month]["sum_avg"]
    
    return jsonify(monthly_aggregated)


@app.route("/restq/stations/datatree")
def stations_datatree():
    """Get data tree showing available years/months/days for each station/serie."""
    logger.info("stations_datatree()")
    
    # Get all stations first
    desc_response = get_stations_desc()
    
    tree = {}
    
    for uid, station_info in desc_response.items():
        name = station_info["name"]
        device_name_uid = f"{name}_{uid}"
        tree[uid] = {}
        
        for serie_name in station_info["serie"].keys():
            tree[uid][serie_name] = {"years": []}
            
            dates_by_year = {}
            
            # Simple approach: query last 7 days with daily summarization
            # This will show all days that have at least one datapoint
            target = f"summarize({METRIC_PREFIX}.{device_name_uid}.{serie_name}.avg, '1d', 'avg')"
            data = query_graphite(target, from_time="-7d")
            
            if data and len(data) > 0:
                datapoints = data[0].get("datapoints", [])
                
                for value, timestamp in datapoints:
                    if value is not None:
                        dt = datetime.fromtimestamp(timestamp)
                        year = dt.strftime("%Y")
                        month = dt.strftime("%m")
                        day = dt.strftime("%d")
                        
                        if year not in dates_by_year:
                            dates_by_year[year] = {}
                        
                        if month not in dates_by_year[year]:
                            dates_by_year[year][month] = set()
                        
                        dates_by_year[year][month].add(day)
            
            # Always add today if we have any recent data
            # Check if the last datapoint was within last 24 hours
            if data and len(data) > 0:
                datapoints = data[0].get("datapoints", [])
                if datapoints:
                    last_dp = datapoints[-1]
                    last_timestamp = last_dp[1]
                    now_ts = datetime.now().timestamp()
                    
                    # If last datapoint is within 24 hours, include today
                    if (now_ts - last_timestamp) < 86400:  # 24 hours in seconds
                        now = datetime.now()
                        year = now.strftime("%Y")
                        month = now.strftime("%m")
                        day = now.strftime("%d")
                        
                        if year not in dates_by_year:
                            dates_by_year[year] = {}
                        
                        if month not in dates_by_year[year]:
                            dates_by_year[year][month] = set()
                        
                        dates_by_year[year][month].add(day)
            
            # Convert to the expected format
            if dates_by_year:
                tree[uid][serie_name]["years"] = sorted(dates_by_year.keys())
                
                for year in dates_by_year:
                    tree[uid][serie_name][year] = {}
                    months_with_data = sorted(dates_by_year[year].keys())
                    tree[uid][serie_name][year]["months"] = months_with_data
                    
                    for month in months_with_data:
                        days_list = sorted(list(dates_by_year[year][month]))
                        tree[uid][serie_name][year][month] = days_list
    
    response = app.response_class(
        response=json.dumps(tree),
        mimetype='application/json'
    )
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    logger.warning(f"404 Not Found: {request.url}")
    return jsonify({
        "error": "Not Found",
        "message": "The requested resource was not found",
        "status": 404
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"500 Internal Server Error: {error}")
    return jsonify({
        "error": "Internal Server Error",
        "message": "An internal error occurred",
        "status": 500
    }), 500


@app.errorhandler(429)
def ratelimit_handler(error):
    """Handle rate limit errors."""
    logger.warning(f"Rate limit exceeded: {get_remote_address()}")
    return jsonify({
        "error": "Too Many Requests",
        "message": "Rate limit exceeded. Please try again later.",
        "status": 429
    }), 429


@app.errorhandler(Exception)
def handle_exception(error):
    """Handle all unhandled exceptions."""
    logger.exception(f"Unhandled exception: {error}")
    
    # Don't expose internal errors in production
    if config["web"].get("debug", False):
        message = str(error)
    else:
        message = "An unexpected error occurred"
    
    return jsonify({
        "error": "Internal Server Error",
        "message": message,
        "status": 500
    }), 500


if __name__ == "__main__":
    logger.info(f"Starting WLab Web Viewer (Original UI + Graphite Backend)")
    logger.info(f"Graphite: {GRAPHITE_URL}")
    logger.info(f"Web: http://{config['web']['host']}:{config['web']['port']}")
    logger.warning("Using Flask development server - not suitable for production!")
    logger.warning("Use Gunicorn for production: gunicorn -c gunicorn.conf.py wsgi:app")
    
    app.run(
        host=config["web"]["host"],
        port=config["web"]["port"],
        debug=config["web"]["debug"]
    )

