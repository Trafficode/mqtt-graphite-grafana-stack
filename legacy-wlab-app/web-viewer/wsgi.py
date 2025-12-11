"""WSGI entry point for production deployment."""
import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from app import app

if __name__ == "__main__":
    app.run()
