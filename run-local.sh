#!/usr/bin/env bash
# TepuQ local runner
# Starts an HTTP server on localhost:8080 and opens the game in Firefox.
# Chrome is preferred for Indonesian TTS; if available, it will be used instead.

set -e

PORT=8080
HOST=localhost
URL="http://${HOST}:${PORT}"

cd "$(dirname "$0")"

# Detect browser
BROWSER=""
if command -v google-chrome &>/dev/null; then
    BROWSER=google-chrome
elif command -v google-chrome-stable &>/dev/null; then
    BROWSER=google-chrome-stable
elif command -v chromium &>/dev/null; then
    BROWSER=chromium
elif command -v chromium-browser &>/dev/null; then
    BROWSER=chromium-browser
elif command -v firefox &>/dev/null; then
    BROWSER=firefox
fi

# Start Python HTTP server
python3 -m http.server "$PORT" &
SERVER_PID=$!

# Wait for server
for i in {1..30}; do
    if curl -s -o /dev/null "${URL}/index.html"; then
        break
    fi
    sleep 0.1
done

echo "TepuQ is running at: ${URL}"
echo "Admin mode:          ${URL}?mode=admin"
echo ""
echo "Press Ctrl+C to stop the server."

# Open browser
if [ -n "$BROWSER" ]; then
    echo "Opening ${URL} in ${BROWSER}..."
    "$BROWSER" "$URL" &
else
    echo "No supported browser found. Please open ${URL} manually."
fi

# Keep server alive
trap 'echo "Stopping server..."; kill $SERVER_PID 2>/dev/null || true; exit' INT TERM
wait $SERVER_PID
