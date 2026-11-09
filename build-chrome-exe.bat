@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher was not found. Install Python 3.10 or newer first.
  pause
  exit /b 1
)

py -3 -m pip install --upgrade -r requirements-build.txt
if errorlevel 1 (
  echo Failed to install build dependencies.
  pause
  exit /b 1
)

py -3 -m PyInstaller --noconfirm --clean --onefile --windowed --name "AppStore - Config Manager" ^
  --add-data "index.html;." ^
  --add-data "version.js;." ^
  --add-data "style.css;." ^
  --add-data "config-list.css;." ^
  --add-data "validate-json.css;." ^
  --add-data "phase2.css;." ^
  --add-data "modal-scroll-lock.css;." ^
  --add-data "apk-reader.js;." ^
  --add-data "script.js;." ^
  --add-data "config-ui.js;." ^
  --add-data "config-import-render.js;." ^
  --add-data "timestamp-manager.js;." ^
  --add-data "modal-behavior.js;." ^
  --add-data "json-validator.js;." ^
  --add-data "import-json-validation.js;." ^
  --add-data "apk-ui.js;." ^
  --add-data "duplicate-app-guard.js;." ^
  --add-data "config-file-chooser.js;." ^
  --add-data "package-importer.js;." ^
  --add-data "package-builder.js;." ^
  --add-data "sample.json;." ^
  --add-data "v01;v01" ^
  --add-data "v02;v02" ^
  --distpath "dist/Windows" ^
  launcher.py

if errorlevel 1 (
  echo EXE build failed.
  pause
  exit /b 1
)

echo.
if not exist "dist" mkdir "dist"
copy /Y "usage.html" "dist\usage.html" >nul
copy /Y "install-run-handler-windows.ps1" "dist\install-run-handler-windows.ps1" >nul
copy /Y "install-run-handler-linux.sh" "dist\install-run-handler-linux.sh" >nul

echo Build completed: dist\Windows\AppStore - Config Manager.exe
pause
