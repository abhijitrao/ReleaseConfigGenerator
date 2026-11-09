# Reusable Chrome-Based Desktop Packaging Guide

This guide explains how to package a small HTML/CSS/JavaScript application as a desktop-style application using **Python + PyInstaller + an installed Google Chrome/Chromium browser**.

It is intended to be reused in other projects. The existing `CHROME-PACKAGING.md` documents how this approach is configured in Release Config Generator; this guide focuses on the reusable pattern.

## 1. How it works

The packaged application has three parts:

1. **Web UI** – your existing HTML, CSS, JavaScript, images, JSON files, and other static assets.
2. **Python launcher** – starts a local HTTP server on `127.0.0.1`, then opens the app URL in Chrome/Chromium app mode (`--app=...`).
3. **PyInstaller executable** – packages the Python launcher and your web assets into a Windows `.exe` or a Linux executable.

The target machine does not need Python installed. It **does need Google Chrome or a supported Chromium browser installed**, because the browser itself is not bundled.

This is a desktop-style wrapper around a web application, not a native desktop UI framework.

## 2. When this approach is suitable

Good fit:
- The application is already built with HTML, CSS, and JavaScript.
- It can run as static files or behind a lightweight local HTTP server.
- Browser features such as LocalStorage are sufficient for local persistence.
- You want a lightweight installer-free executable and can require Chrome/Chromium on the target machine.

Consider another approach when:
- You need a fully self-contained app with no browser prerequisite.
- You need deep native OS integration, native menus, or complex desktop APIs.
- Your application requires a separate backend service or database that has not been designed to run locally.

## 3. Suggested project structure

Keep the launcher and build scripts near the web app entry point. Example:

```text
MyWebTool/
├── index.html
├── styles/
│   └── style.css
├── scripts/
│   └── app.js
├── assets/
│   └── logo.png
├── launcher.py
├── requirements-build.txt
├── build-windows.bat
├── build-linux.sh
└── .github/
    └── workflows/
        └── build-desktop.yml
```

Adapt the asset paths to your actual project. If your app has folders such as `v01/`, `v02/`, `data/`, or `templates/`, include those too.

## 4. Configure the launcher for each project

Create a Python launcher that:

- Locates bundled resources correctly in both development and PyInstaller builds.
- Serves the app only on loopback (`127.0.0.1`), not on the LAN.
- Checks whether the chosen port is already occupied and displays a useful error.
- Finds Chrome/Chromium on Windows and Linux.
- Opens the local URL with `--app=`.
- Uses a dedicated browser profile directory so LocalStorage and other browser data persist.
- Keeps the HTTP server alive while the app window is open, then shuts it down.
- Optionally prevents multiple instances using a Windows named mutex and a Linux file lock.

### Project-specific settings

Keep these values together near the top of the launcher so the same launcher can be reused:

| Setting | Example | What to change |
|---|---|---|
| `APP_NAME` | `My Web Tool` | Display name in messages |
| `HOST` | `127.0.0.1` | Keep loopback for a local-only app |
| `PORT` | `8766` | Choose an unused fixed port |
| `PROFILE_KEY` | `MyWebTool` | Unique folder name for browser data |
| `MUTEX_NAME` | `Local\\MyWebTool` | Unique Windows single-instance name |
| Entry file | `index.html` | Change if your app uses another entry point |

Use a unique profile folder per application. Reusing a profile across unrelated apps can mix cookies, LocalStorage, and browser settings.

### Resource path

When running normally, use the directory containing `launcher.py`. When running as a PyInstaller bundle, use `sys._MEIPASS` as the bundled resource root:

```python
def resource_directory():
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent
```

### Browser profile and LocalStorage

Pass a persistent, application-specific directory through Chrome's `--user-data-dir` argument. Do not put the profile inside the temporary PyInstaller extraction directory; that directory may be removed after the app exits.

Typical locations:
- Windows: `%LOCALAPPDATA%/<AppKey>/ChromeProfile`
- Linux: `$XDG_DATA_HOME/<AppKey>/ChromeProfile`, falling back to `~/.local/share/<AppKey>/ChromeProfile`

LocalStorage is scoped to the origin, so keep the app's scheme, host, and port stable between launches if you want existing LocalStorage data to remain available.

## 5. Install build dependency

Create `requirements-build.txt`:

```text
pyinstaller>=6.0,<7.0
```

Install it on the build machine:

```bash
python -m pip install -r requirements-build.txt
```

Python and PyInstaller are needed only on the build machine, not on the target machine.

## 6. Include the web assets in PyInstaller

PyInstaller must package every file the local server needs. A typical Windows command is:

```bat
pyinstaller --noconfirm --clean --onefile --windowed ^
  --name "My Web Tool" ^
  --add-data "index.html;." ^
  --add-data "styles;styles" ^
  --add-data "scripts;scripts" ^
  --add-data "assets;assets" ^
  launcher.py
```

On Linux, the source/destination separator for `--add-data` is a colon:

```bash
pyinstaller --noconfirm --clean --onefile \
  --name "My Web Tool" \
  --add-data "index.html:." \
  --add-data "styles:styles" \
  --add-data "scripts:scripts" \
  --add-data "assets:assets" \
  launcher.py
```

Replace the example paths with the actual folders in your project. Add one `--add-data` entry for each required file or directory. Do not include build-only files unless the runtime needs them.

If the app uses dynamically loaded files, verify that all referenced assets are included. Test the packaged executable from a different working directory; this catches accidental dependencies on the source checkout.

## 7. Build scripts

### Windows

A simple `build-windows.bat` can install the build dependency and run the Windows PyInstaller command. The output is normally placed in the `dist/` directory.

### Linux

A simple `build-linux.sh` can install the build dependency and run the Linux command. Make it executable with:

```bash
chmod +x build-linux.sh
```

**Build separately on each operating system.** A Windows build produces a Windows executable; a Linux build produces a Linux executable. PyInstaller is not a cross-compiler.

## 8. GitHub Actions (optional)

You can automate both builds using a workflow with a Windows runner and a Linux runner. Each job should:

1. Check out the repository.
2. Set up a supported Python version.
3. Install `requirements-build.txt`.
4. Run the platform's build script.
5. Upload the generated `dist/` output as a workflow artifact.

Trigger the workflow on pushes to your chosen branch and/or on version tags. Keep the Windows and Linux jobs separate so each executable is built on its native operating system.

## 9. Test checklist

Before sharing a build, verify:

- [ ] The executable starts on a clean machine with Chrome/Chromium installed.
- [ ] A clear message appears if Chrome/Chromium is missing.
- [ ] The app opens in a browser app window, not a normal tab.
- [ ] All HTML, CSS, JavaScript, images, and data files load.
- [ ] Refreshing the app works.
- [ ] LocalStorage data remains after closing and reopening the app.
- [ ] A second launch is handled correctly (blocked or focused according to your design).
- [ ] A port conflict shows a useful error instead of silently failing.
- [ ] Closing the app window stops the local server.
- [ ] The executable works when launched from a different folder.
- [ ] Windows and Linux builds are tested on their respective operating systems.

## 10. Common issues

| Symptom | Things to check |
|---|---|
| Chrome not found | Install Chrome/Chromium or extend browser discovery for the target environment |
| Blank page or missing assets | Check the entry file and every PyInstaller `--add-data` path |
| LocalStorage resets | Confirm the profile directory is persistent and the app origin/port has not changed |
| Port already in use | Select another fixed port or identify the process occupying it |
| Works from source but not executable | Check resource-root handling and test the bundled `dist/` output |
| Linux executable does not run on Windows | Build a separate Windows executable on Windows |
| App opens in a normal browser tab | Confirm the launcher uses Chrome/Chromium's `--app=<local URL>` argument |

## 11. Reuse this pattern in another project

For a new project:

1. Confirm the web app can run from a local HTTP server.
2. Copy/adapt the launcher and change the app name, port, profile key, single-instance identifier, and entry file.
3. Update the PyInstaller asset list to match the new project's folders.
4. Add Windows and Linux build scripts.
5. Add a CI workflow if automated builds are required.
6. Test both operating systems and persistence before distributing.

The most important rule is to keep the launcher configuration and PyInstaller asset list aligned with the project's actual structure. A successful PyInstaller build does not guarantee that every runtime asset was included.
