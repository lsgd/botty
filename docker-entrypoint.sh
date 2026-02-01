#!/bin/sh
set -e

# Ensure data directories exist and are writable
mkdir -p /app/data/temp
mkdir -p /app/data/.wwebjs_auth
mkdir -p /app/data/.wwebjs_cache

# Clean up stale Chromium lock files from previous container runs
# These can cause "profile appears to be in use" errors if container didn't shut down cleanly
if [ -d "/app/data/.wwebjs_auth/session" ]; then
    echo "🧹 Cleaning up stale Chromium lock files..."
    rm -f /app/data/.wwebjs_auth/session/SingletonLock
    rm -f /app/data/.wwebjs_auth/session/SingletonSocket
    rm -f /app/data/.wwebjs_auth/session/SingletonCookie
fi

# Start the application
exec "$@"
