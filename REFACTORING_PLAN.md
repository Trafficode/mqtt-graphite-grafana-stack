# Legacy WLAB Application - Comprehensive Refactoring Plan

**Date:** 23 November 2025  
**Author:** Analysis by GitHub Copilot  
**Target:** Modern Python 3.x Architecture with Clean Code Principles

---

## 1. CURRENT ARCHITECTURE ANALYSIS

### 1.1 Overview
The legacy WLAB (WeatherLab) application is a **two-component system** for weather monitoring:

- **wlab_datap** (Data Provider): Backend service that receives MQTT data and manages file-based database
- **wlab_webapp** (Web Application): Flask-based frontend serving REST API and web interface

### 1.2 Component Analysis

#### **A. wlab_datap (Data Provider Service)**

**Purpose:** MQTT data ingestion and file-based database management

**Core Files:**
- `main.py` - Application entry point, DatabaseBot orchestrator
- `dataprovider.py` - File-based database operations (CRUD)
- `mqttcatcher.py` - MQTT client for receiving sensor data
- `ipc.py` - Unix socket IPC server for inter-process communication
- `globals.py` - Configuration constants

**Key Functionality:**
1. **MQTT Data Ingestion:**
   - Subscribes to multiple MQTT brokers
   - Handles 3 topic types: `/wlabauth`, `/wlabdb`, `/wlabdb/bin`
   - Supports both JSON and binary packet formats
   - Converts binary sensor data to JSON format

2. **File-Based Database:**
   - Hierarchical directory structure: `{uid}/{serie}/{year}/{month}/{day}.json`
   - Stores sensor data (temperature, humidity) with statistics (min, max, avg)
   - Maintains station descriptors in `desc.json`
   - Real-time aggregation of daily/monthly/yearly statistics

3. **IPC Server:**
   - Unix socket (`AF_UNIX`) communication
   - Commands: `GET_DESC`, `GET_MONTHLY`, `GET_YEARLY`, `GET_DAILY`, `GET_DATATREE`, `GET_NEWEST`, `SET_SAMPLE`, `SET_DESC`
   - Synchronous request/response pattern

4. **Multi-Broker Support:**
   - Configurable list of MQTT brokers
   - Per-broker topic prefixes
   - MQTT protocol version selection (3.1 vs 3.1.1)

#### **B. wlab_webapp (Web Application)**

**Purpose:** Web interface and REST API for data visualization

**Core Files:**
- `wlabapp.py` - Flask application with REST endpoints
- `ipc.py` - Unix socket IPC client (duplicate of datap version)
- `globals.py` - Configuration constants
- `uwsgi_config.ini` - uWSGI deployment configuration
- `templates/index.html` - Single-page web application
- `static/js/wlabapp/*.js` - JavaScript frontend (jQuery-based)

**Key Functionality:**
1. **REST API Endpoints:**
   - `/globals/version` - Version information
   - `/restq/stations/desc` - Station descriptors
   - `/restq/stations/newest` - Latest measurements
   - `/restq/stations/datatree` - Available data tree
   - `/restq/station/serie/daily/<params>` - Daily data
   - `/restq/station/serie/monthly/<params>` - Monthly data
   - `/restq/station/serie/yearly/<params>` - Yearly data

2. **Frontend:**
   - jQuery-based SPA with Bootstrap 3
   - Three tabs: Home, History, Info
   - CanvasJS charts for visualization
   - Moment.js for timezone handling
   - Custom solar calculations (sunrise/sunset)

3. **Deployment:**
   - uWSGI with 1 process, 2 threads
   - Unix socket communication to nginx
   - Runs as www-data user

### 1.3 Communication Architecture

```
MQTT Brokers
     ↓
[MqttCatcher] → (receives data)
     ↓
[DataProvider] → (stores to filesystem)
     ↓
[IPC Server] ← (Unix socket)
     ↑
[Flask App] → (IPC client)
     ↑
[uWSGI] ← [nginx] ← [Browser]
```

### 1.4 Data Flow

1. **Data Ingestion:**
   ```
   MQTT → MqttCatcher → IPC (SET_SAMPLE) → DataProvider → Filesystem
   ```

2. **Data Retrieval:**
   ```
   Browser → nginx → uWSGI → Flask → IPC (GET_*) → DataProvider → Filesystem
   ```

### 1.5 Configuration Approach

**Current (Legacy):**
- Hardcoded paths in `globals.py`: `/home/wlab/weatherlab/config/`
- Fallback to relative paths in development
- Separate config files for datap and webapp
- Limited environment variable support

---

## 2. IDENTIFIED ISSUES & TECHNICAL DEBT

### 2.1 Python 2.x Code
- **Print statements** instead of functions (though code looks like Python 2/3 compatible)
- **String concatenation** with `+` instead of f-strings
- **Old-style formatting** with `%` operator
- **File I/O:** Using `open()` without context managers
- **os.chmod** with octal notation `0777` (Python 2 syntax)
- **String encoding:** Manual UTF-8 handling needed

### 2.2 Code Quality Issues

**A. Architecture:**
- **Tight coupling:** IPC code duplicated in both components
- **No separation of concerns:** Business logic mixed with I/O operations
- **Monolithic classes:** DataProvider handles too many responsibilities
- **No dependency injection:** Direct instantiation of dependencies
- **Global state:** Config as module-level variable

**B. Error Handling:**
- **Bare except clauses:** `except:` catches all exceptions
- **Silent failures:** Many errors just logged, not propagated
- **No retry logic:** MQTT connection failures sleep and retry indefinitely
- **No graceful shutdown:** Uses `os._exit()` instead of proper cleanup

**C. Data Management:**
- **File-based database:** No ACID guarantees, no concurrent access protection
- **Race conditions:** Multiple writes to same JSON file without locking
- **No data validation:** JSON structure not validated
- **No schema versioning:** Breaking changes would corrupt existing data
- **Inefficient queries:** Full file reads for partial data requests

**D. Security:**
- **No authentication:** IPC server has no access control
- **World-writable socket:** `chmod 0777` on Unix socket
- **No input sanitization:** JSON parameters not validated
- **Hardcoded credentials:** In config files (though using config.json now)

**E. Testing:**
- **No unit tests**
- **No integration tests**
- **No test fixtures**
- **No CI/CD**

### 2.3 Logging Issues
- **Inconsistent levels:** Mix of INFO, DEBUG, CRITICAL
- **No rotation:** Log files grow indefinitely
- **No structured logging:** Plain text only
- **Limited context:** Missing request IDs, user info

### 2.4 Configuration Issues
- **Hardcoded paths:** Absolute paths in code
- **No environment variable support:** Can't override via ENV
- **No config validation:** Invalid config silently fails
- **Separate configs:** datap and webapp have different config files

### 2.5 Deployment Issues
- **Custom startup script:** Bash script with manual restart logic
- **No health checks:** Can't monitor service health
- **No metrics:** No Prometheus/monitoring endpoints
- **No containerization:** Runs directly on host

---

## 3. PROPOSED NEW ARCHITECTURE

### 3.1 Clean Architecture Principles

```
┌─────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                     │
│  (FastAPI REST API, WebSocket for real-time updates)   │
└─────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                      │
│     (Use Cases, Business Logic, Service Orchestration)   │
└─────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                         │
│    (Entities, Value Objects, Domain Services)           │
└─────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                      │
│  (MQTT Client, Database Access, External Services)      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack Updates

**Current → Modern:**
- Python 2.7 → **Python 3.11+**
- Flask → **FastAPI** (async, modern, auto-docs)
- paho-mqtt → **aiomqtt** (async MQTT client)
- File-based DB → **SQLite** or keep files with **proper abstraction**
- Unix sockets IPC → **Redis** or **RabbitMQ** or **merged service**
- uWSGI → **Uvicorn** with **Gunicorn**
- jQuery → **Modern JavaScript** (optional, or keep for simplicity)
- No tests → **pytest**, **pytest-asyncio**
- Manual logging → **structlog**
- No monitoring → **Prometheus** metrics

### 3.3 Unified Service Architecture (Recommended)

**Option A: Single Unified Service (Recommended)**
```
┌──────────────────────────────────────────────────┐
│         WLAB Monitoring Service                  │
│                                                  │
│  ┌────────────────┐      ┌──────────────────┐  │
│  │  MQTT Ingestion│      │   FastAPI REST   │  │
│  │   (async task) │      │    (endpoints)   │  │
│  └────────────────┘      └──────────────────┘  │
│          ↓                         ↑            │
│  ┌─────────────────────────────────────────┐   │
│  │      Data Repository Layer              │   │
│  │  (SQLite/Files with abstraction)        │   │
│  └─────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**Option B: Separate Services (if scaling needed)**
```
┌─────────────────┐         ┌──────────────────┐
│  Data Ingestion │         │   Web API        │
│    Service      │◄───────►│   Service        │
└─────────────────┘  Redis  └──────────────────┘
        ↓                            ↑
┌─────────────────────────────────────────────┐
│           Shared Database Layer             │
│         (SQLite or PostgreSQL)              │
└─────────────────────────────────────────────┘
```

---

## 4. PROPOSED DIRECTORY STRUCTURE

```
wlab-monitoring-service/
├── README.md                      # Comprehensive documentation
├── CHANGELOG.md                   # Version history
├── LICENSE                        # License file
├── pyproject.toml                 # Modern Python packaging
├── setup.py                       # Legacy compatibility
├── requirements.txt               # Production dependencies
├── requirements-dev.txt           # Development dependencies
│
├── config/
│   ├── config.yaml                # Main configuration (YAML)
│   ├── config.example.yaml        # Example configuration
│   ├── logging.yaml               # Logging configuration
│   └── .env.example               # Environment variables example
│
├── systemd/
│   ├── wlab-monitoring.service    # Main service
│   └── wlab-monitoring.timer      # Optional backup timer
│
├── docker/
│   ├── Dockerfile                 # Production image
│   ├── Dockerfile.dev             # Development image
│   └── docker-compose.yml         # Local development stack
│
├── scripts/
│   ├── setup.sh                   # Installation script
│   ├── start.sh                   # Start service
│   ├── stop.sh                    # Stop service
│   ├── backup.sh                  # Backup data
│   └── migrate.py                 # Data migration from legacy
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                # pytest fixtures
│   ├── unit/                      # Unit tests
│   │   ├── test_models.py
│   │   ├── test_services.py
│   │   └── test_repositories.py
│   ├── integration/               # Integration tests
│   │   ├── test_mqtt.py
│   │   ├── test_api.py
│   │   └── test_database.py
│   └── fixtures/                  # Test data
│       ├── sample_mqtt_data.json
│       └── sample_station_desc.json
│
├── src/
│   └── wlab/
│       ├── __init__.py
│       ├── __main__.py            # Entry point: python -m wlab
│       │
│       ├── config/                # Configuration management
│       │   ├── __init__.py
│       │   ├── settings.py        # Pydantic settings
│       │   └── constants.py       # Application constants
│       │
│       ├── domain/                # Domain layer (business logic)
│       │   ├── __init__.py
│       │   ├── models/            # Domain models
│       │   │   ├── __init__.py
│       │   │   ├── station.py     # Station entity
│       │   │   ├── measurement.py # Measurement entity
│       │   │   ├── serie.py       # Serie/sensor type
│       │   │   └── statistics.py  # Statistics value objects
│       │   ├── services/          # Domain services
│       │   │   ├── __init__.py
│       │   │   ├── aggregation.py # Data aggregation logic
│       │   │   └── validation.py  # Business rule validation
│       │   └── exceptions.py      # Domain exceptions
│       │
│       ├── application/           # Application layer (use cases)
│       │   ├── __init__.py
│       │   ├── use_cases/
│       │   │   ├── __init__.py
│       │   │   ├── ingest_measurement.py
│       │   │   ├── register_station.py
│       │   │   ├── get_station_data.py
│       │   │   ├── get_statistics.py
│       │   │   └── get_data_tree.py
│       │   ├── dto/               # Data transfer objects
│       │   │   ├── __init__.py
│       │   │   ├── requests.py    # API request DTOs
│       │   │   └── responses.py   # API response DTOs
│       │   └── interfaces/        # Repository interfaces
│       │       ├── __init__.py
│       │       ├── station_repository.py
│       │       └── measurement_repository.py
│       │
│       ├── infrastructure/        # Infrastructure layer
│       │   ├── __init__.py
│       │   ├── database/          # Database implementations
│       │   │   ├── __init__.py
│       │   │   ├── sqlite.py      # SQLite repository
│       │   │   ├── file_storage.py # File-based repository
│       │   │   ├── migrations/    # Database migrations
│       │   │   └── schema.sql     # Database schema
│       │   ├── mqtt/              # MQTT client
│       │   │   ├── __init__.py
│       │   │   ├── client.py      # Async MQTT client
│       │   │   ├── handlers.py    # Message handlers
│       │   │   └── protocols.py   # Binary protocol parsing
│       │   ├── cache/             # Caching layer
│       │   │   ├── __init__.py
│       │   │   └── redis_cache.py # Redis cache (optional)
│       │   └── logging/           # Logging setup
│       │       ├── __init__.py
│       │       └── setup.py       # Structured logging config
│       │
│       ├── api/                   # Presentation layer
│       │   ├── __init__.py
│       │   ├── main.py            # FastAPI app factory
│       │   ├── dependencies.py    # FastAPI dependencies
│       │   ├── middleware.py      # Custom middleware
│       │   ├── routes/            # API endpoints
│       │   │   ├── __init__.py
│       │   │   ├── health.py      # Health checks
│       │   │   ├── stations.py    # Station endpoints
│       │   │   ├── measurements.py # Measurement endpoints
│       │   │   ├── statistics.py  # Statistics endpoints
│       │   │   └── websocket.py   # WebSocket real-time updates
│       │   └── schemas/           # Pydantic schemas
│       │       ├── __init__.py
│       │       ├── station.py
│       │       ├── measurement.py
│       │       └── statistics.py
│       │
│       ├── cli/                   # Command-line interface
│       │   ├── __init__.py
│       │   ├── main.py            # CLI entry point (Click)
│       │   ├── commands/
│       │   │   ├── __init__.py
│       │   │   ├── migrate.py     # Data migration
│       │   │   ├── backup.py      # Backup data
│       │   │   └── serve.py       # Start server
│       │   └── utils.py
│       │
│       └── utils/                 # Shared utilities
│           ├── __init__.py
│           ├── datetime.py        # DateTime utilities
│           ├── solar.py           # Solar calculation (sunrise/sunset)
│           └── validators.py      # Input validators
│
└── frontend/                      # Frontend (optional refactor)
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── main.js
    │   ├── App.vue               # Or React/Vanilla JS
    │   └── components/
    └── dist/                     # Build output
```

---

## 5. KEY REFACTORING CHANGES

### 5.1 Python 2 → Python 3 Migration

| Legacy Code | Modern Code |
|-------------|-------------|
| `print "hello"` | `print("hello")` |
| `"format %s" % val` | `f"format {val}"` |
| `os.chmod(path, 0777)` | `os.chmod(path, 0o777)` |
| `file = open()` | `with open() as file:` |
| `except:` | `except Exception as e:` |
| `str.decode('utf-8')` | Native string handling |
| `.iteritems()` | `.items()` |
| `dict.has_key()` | `key in dict` |

### 5.2 Code Style Improvements

**A. Type Hints (Python 3.5+)**
```python
# Legacy
def get_station_data(uid, serie, date):
    return data

# Modern
def get_station_data(uid: str, serie: str, date: datetime) -> StationData:
    return data
```

**B. Context Managers**
```python
# Legacy
file = open(path, 'r')
data = json.load(file)
file.close()

# Modern
with open(path, 'r') as file:
    data = json.load(file)
```

**C. Async/Await**
```python
# Legacy (blocking)
def on_message(client, userdata, msg):
    data = json.loads(msg.payload)
    store_data(data)

# Modern (async)
async def on_message(message):
    data = json.loads(message.payload)
    await store_data(data)
```

**D. Dataclasses/Pydantic**
```python
# Legacy
sample_json = {
    "f_avg": serie["f_avg"],
    "f_act": serie["f_act"],
    # ...
}

# Modern
@dataclass
class MeasurementStats:
    f_avg: float
    f_act: float
    f_min: float
    f_max: float
    i_min_ts: int
    i_max_ts: int
```

### 5.3 Architecture Changes

**A. Replace IPC with Direct Integration**
```python
# Legacy: Two processes + Unix socket
[MQTT Service] --IPC--> [Flask Service]

# Modern: Single async service
[FastAPI Service]
    ├── MQTT background task
    └── REST endpoints
```

**B. Repository Pattern**
```python
# Legacy: Direct filesystem access
class DataProvider:
    def stationRegister(self, uid, descriptor):
        path = os.path.join(self.dbPath, uid)
        os.makedirs(path)
        # ...

# Modern: Repository abstraction
class StationRepository(ABC):
    @abstractmethod
    async def save(self, station: Station) -> None: ...
    
    @abstractmethod
    async def get_by_id(self, station_id: str) -> Optional[Station]: ...

class FileStationRepository(StationRepository):
    async def save(self, station: Station) -> None:
        # Implementation
```

**C. Dependency Injection**
```python
# Legacy: Direct instantiation
data_provider = DataProvider('/path/to/db')

# Modern: DI with FastAPI
def get_station_repo() -> StationRepository:
    return FileStationRepository(settings.database_path)

@app.get("/stations/{station_id}")
async def get_station(
    station_id: str,
    repo: StationRepository = Depends(get_station_repo)
):
    return await repo.get_by_id(station_id)
```

### 5.4 Configuration Management

**Modern Approach with Pydantic:**
```python
from pydantic_settings import BaseSettings

class MQTTSettings(BaseSettings):
    broker: str
    port: int = 1883
    topic_prefix: str = ""
    username: str = ""
    password: str = ""
    
    class Config:
        env_prefix = "MQTT_"

class DatabaseSettings(BaseSettings):
    path: Path
    type: Literal["sqlite", "file"] = "file"
    
    class Config:
        env_prefix = "DB_"

class Settings(BaseSettings):
    mqtt: MQTTSettings
    database: DatabaseSettings
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```

### 5.5 Logging Improvements

**Structured Logging with structlog:**
```python
import structlog

logger = structlog.get_logger()

# Legacy
logger.info("Got sample data: %s" % str(param))

# Modern
logger.info("sample_received", 
           station_id=param["uid"],
           timestamp=param["ts"],
           series_count=len(param["SERIE"]))
```

---

## 6. DATA MIGRATION STRATEGY

### 6.1 Database Migration

**Option A: Keep File-Based Storage**
- Refactor to use repository pattern
- Add file locking for concurrent access
- Implement proper error handling
- Add data validation

**Option B: Migrate to SQLite**
```sql
-- schema.sql
CREATE TABLE stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    timezone TEXT,
    latitude REAL,
    longitude REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT,
    FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE TABLE measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serie_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    value_actual REAL,
    value_avg REAL,
    value_min REAL,
    value_max REAL,
    min_timestamp INTEGER,
    max_timestamp INTEGER,
    FOREIGN KEY (serie_id) REFERENCES series(id)
);

CREATE INDEX idx_measurements_timestamp ON measurements(timestamp);
CREATE INDEX idx_measurements_serie ON measurements(serie_id);
```

**Migration Script:**
```python
async def migrate_legacy_data(legacy_path: Path, db: Database):
    """Migrate data from legacy file structure to SQLite"""
    for station_dir in legacy_path.iterdir():
        if not station_dir.is_dir():
            continue
            
        # Read station descriptor
        desc_path = station_dir / "desc.json"
        if desc_path.exists():
            with open(desc_path) as f:
                desc = json.load(f)
            await db.save_station(Station.from_legacy(desc))
        
        # Migrate measurements
        for serie_dir in station_dir.iterdir():
            if serie_dir.name == "desc.json":
                continue
            # ... migrate time-series data
```

### 6.2 Configuration Migration

```python
def convert_legacy_config(legacy_config_path: Path) -> dict:
    """Convert legacy config to new format"""
    # Read legacy wlabdatap.json and wlabwebapp.json
    # Merge into single config.yaml
    pass
```

---

## 7. DEPENDENCIES LIST

### 7.1 Production Dependencies

```toml
# pyproject.toml
[project]
name = "wlab-monitoring"
version = "2.0.0"
requires-python = ">=3.11"
dependencies = [
    # Web Framework
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "gunicorn>=21.2.0",
    
    # MQTT
    "aiomqtt>=1.2.0",        # Async MQTT client
    "paho-mqtt>=1.6.1",      # MQTT protocol
    
    # Database
    "aiosqlite>=0.19.0",     # Async SQLite
    "sqlalchemy>=2.0.0",     # ORM (optional)
    
    # Configuration
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "python-dotenv>=1.0.0",
    "pyyaml>=6.0",
    
    # Logging
    "structlog>=23.2.0",
    "python-json-logger>=2.0.7",
    
    # DateTime
    "python-dateutil>=2.8.2",
    "pytz>=2023.3",
    
    # Data Validation
    "validators>=0.22.0",
    
    # Monitoring
    "prometheus-client>=0.19.0",
    
    # Utilities
    "click>=8.1.7",          # CLI
    "httpx>=0.25.0",         # HTTP client for testing
]

[project.optional-dependencies]
dev = [
    # Testing
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.1.0",
    "pytest-mock>=3.12.0",
    
    # Code Quality
    "black>=23.11.0",
    "ruff>=0.1.6",
    "mypy>=1.7.0",
    "isort>=5.12.0",
    
    # Development
    "ipython>=8.17.0",
    "pre-commit>=3.5.0",
]
```

### 7.2 System Dependencies
```bash
# Debian/Ubuntu
apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    redis-server  # Optional for caching
```

---

## 8. CONFIGURATION APPROACH

### 8.1 Configuration Files

**config/config.yaml** (Main configuration)
```yaml
app:
  name: "WLAB Monitoring Service"
  version: "2.0.0"
  debug: false

server:
  host: "0.0.0.0"
  port: 8000
  workers: 4

mqtt:
  brokers:
    - host: "194.42.111.14"
      port: 1883
      topic_prefix: "wlab/graphite"
      topics:
        - "+/data"
      username: ""
      password: ""
      protocol: "3.1.1"
      keepalive: 60
      
database:
  type: "file"  # or "sqlite"
  path: "/mnt/nvme/monitoring-data/wlab"
  sqlite_url: "sqlite+aiosqlite:///wlab.db"  # if type=sqlite
  
logging:
  level: "INFO"
  format: "json"  # or "console"
  file: "/var/log/wlab/wlab.log"
  rotation: "100 MB"
  retention: "30 days"

monitoring:
  metrics_enabled: true
  metrics_port: 9090
  health_check_interval: 30
```

**config/.env.example** (Environment variables)
```bash
# Application
WLAB_ENV=production
WLAB_LOG_LEVEL=INFO

# Database
WLAB_DB_PATH=/mnt/nvme/monitoring-data/wlab
WLAB_DB_TYPE=file

# MQTT
WLAB_MQTT_BROKER=194.42.111.14
WLAB_MQTT_PORT=1883
WLAB_MQTT_USERNAME=
WLAB_MQTT_PASSWORD=

# Security
WLAB_SECRET_KEY=your-secret-key-here
WLAB_API_KEY=optional-api-key

# Monitoring
WLAB_METRICS_ENABLED=true
```

### 8.2 Priority Order
1. Environment variables (highest)
2. .env file
3. config.yaml
4. Default values (lowest)

---

## 9. SYSTEMD SERVICE FILES

### 9.1 Main Service

**systemd/wlab-monitoring.service**
```ini
[Unit]
Description=WLAB Weather Monitoring Service
After=network.target
Wants=network-online.target

[Service]
Type=notify
User=wlab
Group=wlab
WorkingDirectory=/opt/wlab-monitoring

# Environment
Environment="WLAB_ENV=production"
EnvironmentFile=/opt/wlab-monitoring/config/.env

# Start command
ExecStart=/opt/wlab-monitoring/venv/bin/python -m wlab serve

# Restart policy
Restart=always
RestartSec=10s
StartLimitInterval=5min
StartLimitBurst=5

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/mnt/nvme/monitoring-data /var/log/wlab

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wlab-monitoring

# Resource limits
LimitNOFILE=65536
TasksMax=4096

[Install]
WantedBy=multi-user.target
```

### 9.2 Backup Timer

**systemd/wlab-monitoring-backup.timer**
```ini
[Unit]
Description=Daily backup of WLAB monitoring data
Requires=wlab-monitoring-backup.service

[Timer]
OnCalendar=daily
OnCalendar=04:00
Persistent=true

[Install]
WantedBy=timers.target
```

**systemd/wlab-monitoring-backup.service**
```ini
[Unit]
Description=Backup WLAB monitoring data

[Service]
Type=oneshot
User=wlab
Group=wlab
ExecStart=/opt/wlab-monitoring/scripts/backup.sh

[Install]
WantedBy=multi-user.target
```

---

## 10. TESTING STRATEGY

### 10.1 Test Structure

```python
# tests/conftest.py
import pytest
from pathlib import Path

@pytest.fixture
async def db():
    """Provide test database"""
    # Setup
    yield test_db
    # Teardown

@pytest.fixture
def sample_measurement():
    """Sample measurement data"""
    return {
        "UID": "AABBCCDDEEFF",
        "TS": 1700000000,
        "SERIE": {
            "Temperature": {
                "f_avg": 21.5,
                "f_act": 22.0,
                "f_min": 20.0,
                "f_max": 24.0,
                "i_min_ts": 1700000000,
                "i_max_ts": 1700003600
            }
        }
    }

# tests/unit/test_models.py
def test_measurement_from_dict(sample_measurement):
    """Test Measurement model creation"""
    m = Measurement.from_dict(sample_measurement)
    assert m.station_id == "AABBCCDDEEFF"
    assert m.timestamp == 1700000000

# tests/integration/test_mqtt.py
@pytest.mark.asyncio
async def test_mqtt_message_processing():
    """Test MQTT message ingestion end-to-end"""
    pass
```

### 10.2 Test Coverage Goals
- Unit tests: >80% coverage
- Integration tests: Critical paths
- End-to-end tests: Key user journeys

---

## 11. MIGRATION ROADMAP

### Phase 1: Foundation (Week 1-2)
- [ ] Set up new project structure
- [ ] Configure development environment
- [ ] Create base configuration system
- [ ] Set up logging infrastructure
- [ ] Write migration scripts for legacy data

### Phase 2: Domain Layer (Week 2-3)
- [ ] Define domain models (Station, Measurement, Serie)
- [ ] Implement value objects (Statistics, TimeRange)
- [ ] Create domain services (Aggregation, Validation)
- [ ] Write unit tests for domain layer

### Phase 3: Infrastructure Layer (Week 3-4)
- [ ] Implement repository interfaces
- [ ] Create file-based repository (backward compatible)
- [ ] Optional: SQLite repository
- [ ] Implement MQTT client (async)
- [ ] Binary protocol parser
- [ ] Write integration tests

### Phase 4: Application Layer (Week 4-5)
- [ ] Implement use cases
- [ ] Create DTOs
- [ ] Wire up dependencies
- [ ] Write use case tests

### Phase 5: API Layer (Week 5-6)
- [ ] Implement FastAPI endpoints
- [ ] Add request/response schemas
- [ ] Create WebSocket endpoints (real-time)
- [ ] Add middleware (logging, error handling)
- [ ] API documentation
- [ ] API tests

### Phase 6: Testing & Documentation (Week 6-7)
- [ ] Complete test coverage
- [ ] Performance testing
- [ ] Security audit
- [ ] Write comprehensive README
- [ ] Create deployment guide
- [ ] Migration documentation

### Phase 7: Deployment (Week 7-8)
- [ ] Create systemd service files
- [ ] Write deployment scripts
- [ ] Set up monitoring
- [ ] Create backup procedures
- [ ] Gradual rollout
- [ ] Performance monitoring

---

## 12. BACKWARD COMPATIBILITY

### 12.1 API Compatibility
```python
# Keep legacy endpoints for transition period
@app.get("/restq/stations/desc")
async def legacy_stations_desc():
    """Legacy endpoint - redirects to new API"""
    return RedirectResponse("/api/v2/stations")

# New versioned API
@app.get("/api/v2/stations")
async def get_stations():
    """Modern endpoint"""
    pass
```

### 12.2 Data Format Compatibility
- Support reading legacy file structure
- Gradual migration to new format
- Dual-write during transition

---

## 13. MONITORING & OBSERVABILITY

### 13.1 Health Checks
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "uptime": get_uptime(),
        "components": {
            "database": await check_db(),
            "mqtt": await check_mqtt(),
        }
    }
```

### 13.2 Metrics (Prometheus)
```python
from prometheus_client import Counter, Histogram

mqtt_messages_total = Counter(
    'wlab_mqtt_messages_total',
    'Total MQTT messages received',
    ['topic', 'status']
)

api_request_duration = Histogram(
    'wlab_api_request_duration_seconds',
    'API request duration',
    ['endpoint', 'method']
)
```

### 13.3 Logging Best Practices
```python
logger.info(
    "measurement_stored",
    station_id=station.id,
    serie=serie.name,
    timestamp=measurement.timestamp,
    duration_ms=duration
)
```

---

## 14. DOCUMENTATION REQUIREMENTS

### 14.1 README.md Structure
```markdown
# WLAB Monitoring Service v2.0

## Overview
Brief description of the service

## Features
- MQTT data ingestion
- REST API
- Real-time WebSocket updates
- Historical data queries

## Quick Start
Installation and basic usage

## Configuration
Configuration guide

## API Documentation
Link to OpenAPI docs (auto-generated by FastAPI)

## Development
Development setup guide

## Deployment
Production deployment guide

## Migration
Guide for migrating from v1.x

## Contributing
Contribution guidelines

## License
```

### 14.2 Code Documentation
- Docstrings for all public functions/classes
- Type hints everywhere
- Examples in docstrings
- Architectural decision records (ADR)

---

## 15. SUMMARY OF KEY CHANGES

### 15.1 Technical Changes
| Component | Legacy | Modern |
|-----------|--------|--------|
| Python Version | 2.7 | 3.11+ |
| Web Framework | Flask + uWSGI | FastAPI + Uvicorn |
| MQTT Client | paho-mqtt (sync) | aiomqtt (async) |
| IPC | Unix sockets | Merged service / Redis |
| Configuration | Hardcoded paths | Pydantic + env vars |
| Logging | Basic logging | structlog |
| Testing | None | pytest + 80% coverage |
| Type System | None | Full type hints |
| Architecture | Monolithic | Clean Architecture |
| Database | Files only | Files + SQLite option |

### 15.2 Non-Functional Improvements
- **Performance:** Async I/O, connection pooling
- **Reliability:** Proper error handling, retries
- **Security:** Input validation, API auth
- **Observability:** Metrics, structured logs
- **Maintainability:** Clean code, tests
- **Scalability:** Async design, stateless API

### 15.3 Code Quality Metrics
- **Before:** 
  - No tests
  - No type hints
  - Mixed responsibilities
  - Global state
  
- **After:**
  - 80%+ test coverage
  - Full type hints
  - SOLID principles
  - Dependency injection

---

## 16. RISKS & MITIGATION

### 16.1 Risks
1. **Data loss during migration**
   - Mitigation: Comprehensive backup before migration
   - Dual-write period with validation

2. **Breaking API changes**
   - Mitigation: Maintain legacy endpoints initially
   - Versioned API (/api/v1, /api/v2)

3. **Performance regression**
   - Mitigation: Load testing before deployment
   - Gradual rollout with monitoring

4. **MQTT message loss**
   - Mitigation: QoS level configuration
   - Message persistence and retry logic

### 16.2 Rollback Plan
- Keep legacy service running in parallel
- Database snapshots before migration
- Feature flags for gradual rollout
- Automated rollback scripts

---

## 17. SUCCESS CRITERIA

### 17.1 Functional
- [ ] All legacy API endpoints work
- [ ] MQTT data ingestion operational
- [ ] Historical data accessible
- [ ] Real-time updates via WebSocket
- [ ] Data migration complete and verified

### 17.2 Non-Functional
- [ ] API response time <100ms (p95)
- [ ] MQTT message processing <50ms
- [ ] System uptime >99.9%
- [ ] Test coverage >80%
- [ ] Zero data loss during migration

### 17.3 Quality
- [ ] All linting checks pass
- [ ] Type checking passes (mypy)
- [ ] Security scan passes
- [ ] Documentation complete
- [ ] Code review approved

---

## CONCLUSION

This refactoring plan transforms the legacy WLAB application from a Python 2.7-based system with technical debt into a modern, maintainable, and scalable Python 3.11+ service following clean architecture principles.

**Key Benefits:**
1. **Maintainability:** Clean architecture, comprehensive tests
2. **Performance:** Async I/O, optimized data access
3. **Reliability:** Proper error handling, monitoring
4. **Security:** Input validation, authentication
5. **Developer Experience:** Type hints, auto-docs, modern tooling

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Iterative development with continuous testing
5. Gradual migration and rollout

**Estimated Timeline:** 7-8 weeks for complete refactoring with thorough testing and documentation.
