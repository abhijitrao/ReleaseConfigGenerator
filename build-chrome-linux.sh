#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

python3 -m pip install --user --upgrade -r requirements-build.txt
python3 -m PyInstaller --noconfirm --clean --onefile --name "AppStore - Config Manager" \
  --add-data "index.html:." \
  --add-data "usage.html:." \
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
  --distpath "dist/Linux" \\
  launcher.py

chmod +x "dist/Linux/AppStore - Config Manager"
cp "usage.html" "dist/usage.html"
cp "install-run-handler-windows.ps1" "dist/install-run-handler-windows.ps1"
cp "install-run-handler-linux.sh" "dist/install-run-handler-linux.sh"
chmod +x "dist/install-run-handler-linux.sh"
echo "Build completed: dist/Linux/AppStore - Config Manager"
