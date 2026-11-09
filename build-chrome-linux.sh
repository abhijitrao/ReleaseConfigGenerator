#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

python3 -m pip install --user --upgrade -r requirements-build.txt
python3 -m PyInstaller --noconfirm --clean --onefile --name "AppStore - Config Manager" \
  --add-data "index.html:." \
  --add-data "version.js:." \
  --add-data "style.css:." \
  --add-data "config-list.css:." \
  --add-data "validate-json.css:." \
  --add-data "phase2.css:." \
  --add-data "modal-scroll-lock.css:." \
  --add-data "apk-reader.js:." \
  --add-data "script.js:." \
  --add-data "config-ui.js:." \
  --add-data "config-import-render.js:." \
  --add-data "timestamp-manager.js:." \
  --add-data "modal-behavior.js:." \
  --add-data "json-validator.js:." \
  --add-data "import-json-validation.js:." \
  --add-data "apk-ui.js:." \
  --add-data "duplicate-app-guard.js:." \
  --add-data "config-file-chooser.js:." \
  --add-data "package-importer.js:." \
  --add-data "package-builder.js:." \
  --add-data "sample.json:." \
  --add-data "v01:v01" \
  --add-data "v02:v02" \
  --distpath "dist/Linux" \
  launcher.py

PACKAGE_DIR="dist/AppStore-Config-Manager-Ubuntu"
mkdir -p "$PACKAGE_DIR"
install -m 755 "dist/Linux/AppStore - Config Manager" "$PACKAGE_DIR/AppStore - Config Manager"
tar -czf "dist/AppStore-Config-Manager-Ubuntu.tar.gz" -C dist "AppStore-Config-Manager-Ubuntu"
cp "usage.html" "dist/usage.html"
echo "Build completed: dist/AppStore-Config-Manager-Ubuntu.tar.gz"
