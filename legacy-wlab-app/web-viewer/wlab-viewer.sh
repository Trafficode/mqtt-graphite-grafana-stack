#!/bin/bash
# WLab Web Viewer Control Script
# Usage: ./wlab-viewer.sh {start|stop|restart|status|logs}

WORKDIR="/home/kku/workspace/mqtt-graphite-grafana-stack/legacy-wlab-app/web-viewer"
PIDFILE="/tmp/wlab-viewer.pid"
VENV="$WORKDIR/venv"
LOGDIR="$WORKDIR/logs"

cd "$WORKDIR" || exit 1

case "$1" in
    start)
        if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
            echo "WLab Web Viewer is already running (PID: $(cat $PIDFILE))"
            exit 1
        fi
        
        echo "Starting WLab Web Viewer..."
        mkdir -p "$LOGDIR"
        
        "$VENV/bin/gunicorn" \
            -w 4 \
            -b 0.0.0.0:8050 \
            --daemon \
            --pid "$PIDFILE" \
            --access-logfile "$LOGDIR/access.log" \
            --error-logfile "$LOGDIR/error.log" \
            wsgi:app
        
        sleep 1
        if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
            echo "✓ WLab Web Viewer started successfully (PID: $(cat $PIDFILE))"
            echo "  Web UI: http://192.168.1.11:8050"
            echo "  Health: http://192.168.1.11:8050/health"
        else
            echo "✗ Failed to start WLab Web Viewer"
            echo "  Check logs: $LOGDIR/error.log"
            exit 1
        fi
        ;;
        
    stop)
        if [ ! -f "$PIDFILE" ]; then
            echo "WLab Web Viewer is not running (no PID file)"
            exit 1
        fi
        
        PID=$(cat "$PIDFILE")
        echo "Stopping WLab Web Viewer (PID: $PID)..."
        
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            sleep 2
            
            if kill -0 "$PID" 2>/dev/null; then
                echo "Forcing stop..."
                kill -9 "$PID"
            fi
            
            rm -f "$PIDFILE"
            echo "✓ WLab Web Viewer stopped"
        else
            echo "Process not found, removing stale PID file"
            rm -f "$PIDFILE"
        fi
        ;;
        
    restart)
        $0 stop
        sleep 1
        $0 start
        ;;
        
    status)
        if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
            PID=$(cat "$PIDFILE")
            echo "✓ WLab Web Viewer is running (PID: $PID)"
            echo ""
            
            # Show process info
            ps -p "$PID" -o pid,ppid,%cpu,%mem,etime,cmd
            
            # Test health endpoint
            echo ""
            echo "Health check:"
            curl -s http://localhost:8050/health | python3 -m json.tool 2>/dev/null || echo "  Health endpoint not responding"
            
            # Show recent access
            echo ""
            echo "Recent access (last 5):"
            tail -5 "$LOGDIR/access.log" 2>/dev/null || echo "  No access logs yet"
        else
            echo "✗ WLab Web Viewer is not running"
            exit 1
        fi
        ;;
        
    logs)
        echo "=== Error Log (last 20 lines) ==="
        tail -20 "$LOGDIR/error.log" 2>/dev/null || echo "No error logs"
        echo ""
        echo "=== Access Log (last 20 lines) ==="
        tail -20 "$LOGDIR/access.log" 2>/dev/null || echo "No access logs"
        echo ""
        echo "Follow logs with: tail -f $LOGDIR/access.log"
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the web viewer"
        echo "  stop    - Stop the web viewer"
        echo "  restart - Restart the web viewer"
        echo "  status  - Show running status and health"
        echo "  logs    - Show recent logs"
        exit 1
        ;;
esac
