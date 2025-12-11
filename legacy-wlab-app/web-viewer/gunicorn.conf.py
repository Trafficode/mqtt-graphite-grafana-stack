"""Gunicorn configuration for production deployment."""
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:8050"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
timeout = 30
keepalive = 2

# Process naming
proc_name = "wlab-viewer"

# Logging
accesslog = "./logs/gunicorn-access.log"
errorlog = "./logs/gunicorn-error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Server mechanics
daemon = False
pidfile = "./logs/gunicorn.pid"
user = None
group = None
tmp_upload_dir = None

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Development settings (override with environment variable)
if os.getenv("FLASK_ENV") == "development":
    reload = True
    loglevel = "debug"
    workers = 2
