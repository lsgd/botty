#!/bin/sh
set -e

# Ensure data directories exist and are writable
mkdir -p /app/data/temp
mkdir -p /app/data/.wwebjs_auth
mkdir -p /app/data/.wwebjs_cache

# Start the application
exec "$@"
