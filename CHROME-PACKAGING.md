# AppStore - Config Manager — Chrome-based builds

This packaging option runs the existing browser application in an installed Google Chrome or Chromium app window. It does not embed Chromium or Electron.

## Windows build
1. Install Python 3.10 or newer on the build machine.
2. Run `build-chrome-exe.bat`.
3. Find `dist/AppStore - Config Manager.exe`.

## Linux build
1. Install Python 3.10 or newer on the build machine.
2. Ensure Google Chrome or Chromium is installed on the target machine.
3. Run `chmod +x build-chrome-linux.sh && ./build-chrome-linux.sh`.
4. Find `dist/AppStore - Config Manager`.

The target machine does not need Python, but it must have Chrome or Chromium installed.

## Runtime behavior
- Local HTTP server binds only to `127.0.0.1:8766`.
- The app opens in a dedicated Chrome/Chromium app window.
- Closing the app window stops the local server and launcher.
- A Windows named mutex / Linux file lock prevents duplicate launcher instances.
- Dedicated browser profile preserves LocalStorage:
  - Windows: `%LOCALAPPDATA%/ReleaseConfigGenerator/ChromeProfile`
  - Linux: `$XDG_DATA_HOME/ReleaseConfigGenerator/ChromeProfile`, defaulting to `~/.local/share/ReleaseConfigGenerator/ChromeProfile`.
- The project root files and `v01` / `v02` folders are bundled with the executable.
- The local server is not exposed to the LAN.

## Notes
- Port 8766 must be available. The app reports an error if it is already occupied.
- The dedicated Chrome profile is separate from the user's normal Chrome profile.
- GitHub Actions creates separate Windows and Linux artifacts for the packaging branch.
