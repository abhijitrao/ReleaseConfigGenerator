#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$ROOT_DIR/Linux/AppStore - Config Manager"

if [[ ! -f "$APP_PATH" ]]; then
  echo "Linux application was not found: $APP_PATH" >&2
  exit 1
fi

chmod +x "$APP_PATH"

APP_PATH_ESCAPED="$(printf '%s' "$APP_PATH" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\`/\\\`/g' -e 's/\$/\\\$/g')"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$DESKTOP_DIR/appstore-config.desktop"
mkdir -p "$DESKTOP_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=AppStore Config Manager
Comment=Launch AppStore Config Manager
Type=Application
NoDisplay=true
Terminal=false
Exec="$APP_PATH_ESCAPED" %u
MimeType=x-scheme-handler/appstore-config;
EOF

chmod 644 "$DESKTOP_FILE"
if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default appstore-config.desktop x-scheme-handler/appstore-config
else
  echo "xdg-mime was not found. Install xdg-utils, then run:"
  echo "xdg-mime default appstore-config.desktop x-scheme-handler/appstore-config"
  exit 1
fi

echo "Run button is now registered for this Linux user."
echo "You can close this terminal and return to usage.html."
