#!/bin/bash
# Clean up all data and containers

set -e

echo "WARNING: This will remove all containers and data!"
read -p "Are you sure? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo "Stopping and removing containers..."
docker-compose down -v

echo "Removing data directories..."
read -p "Remove data directories? This will delete all metrics and dashboards! (yes/no): " -r
echo

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    sudo rm -rf data/graphite/* data/grafana/*
    echo "Data directories cleaned"
fi

echo ""
echo "Cleanup completed!"
echo ""
