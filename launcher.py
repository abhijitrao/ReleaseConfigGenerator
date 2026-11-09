import ctypes
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_NAME = "Release Config Generator"
HOST = "127.0.0.1"
PORT = 8766
MUTEX_NAME = r"Local\ReleaseConfigGeneratorChromeBasedExe"

if sys.platform == "win32":
    PROFILE_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "ReleaseConfigGenerator" / "ChromeProfile"
else:
    PROFILE_DIR = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "ReleaseConfigGenerator" / "ChromeProfile"


def show_message(title, message, error=False):
    if sys.platform == "win32":
        flags = 0x10 if error else 0x40
        ctypes.windll.user32.MessageBoxW(None, message, title, flags)
        return

    # Prefer a desktop notification/dialog, but remain usable on minimal Linux installs.
    if shutil.which("zenity"):
        icon = "error" if error else "info"
        subprocess.run(["zenity", "--" + icon, "--title", title, "--text", message], check=False)
    elif shutil.which("notify-send"):
        subprocess.run(["notify-send", title, message], check=False)
    else:
        print(f"{title}: {message}", file=sys.stderr if error else sys.stdout)


def acquire_single_instance():
    if sys.platform == "win32":
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL
        handle = kernel32.CreateMutexW(None, False, MUTEX_NAME)
        if not handle:
            show_message(APP_NAME, "Could not initialize the application.", True)
            return None
        if ctypes.get_last_error() == 183:  # ERROR_ALREADY_EXISTS
            show_message(APP_NAME, "Release Config Generator is already running in Chrome.")
            kernel32.CloseHandle(handle)
            return None
        return ("windows", handle, kernel32)

    # Linux: keep the lock file descriptor open for the lifetime of this process.
    import fcntl

    lock_path = Path(tempfile.gettempdir()) / "release-config-generator-chrome.lock"
    lock_file = open(lock_path, "w")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        show_message(APP_NAME, "Release Config Generator is already running in Chrome.")
        return None
    return ("linux", lock_file, fcntl)


def release_single_instance(lock):
    if not lock:
        return
    platform, handle, api = lock
    if platform == "windows":
        api.CloseHandle(handle)
    else:
        api.flock(handle.fileno(), api.LOCK_UN)
        handle.close()


def resource_directory():
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def find_chrome():
    if sys.platform == "win32":
        candidates = [
            Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
        ]
        for candidate in candidates:
            if candidate.is_file():
                return str(candidate)
        return shutil.which("chrome") or shutil.which("google-chrome")

    for executable in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(executable)
        if found:
            return found
    return None


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass

    def _send_json(self, status, payload):
        import json

        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # These actions are intentionally limited to this local launcher.
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            self._send_json(403, {"ok": False, "message": "Local access only."})
            return

        if self.path == "/__launcher/open-folder":
            try:
                folder = application_directory()
                if sys.platform == "win32":
                    os.startfile(str(folder))
                else:
                    subprocess.Popen(["xdg-open", str(folder)], start_new_session=True)
                self._send_json(200, {"ok": True, "message": "Application folder opened."})
            except Exception as exc:
                self._send_json(500, {"ok": False, "message": str(exc)})
            return

        if self.path == "/__launcher/launch-app":
            try:
                executable = application_executable()
                if not executable.is_file():
                    self._send_json(404, {"ok": False, "message": f"Application executable not found: {executable.name}"})
                    return
                if sys.platform == "win32":
                    subprocess.Popen([str(executable)], cwd=str(executable.parent), close_fds=True)
                else:
                    executable.chmod(executable.stat().st_mode | 0o111)
                    subprocess.Popen([str(executable)], cwd=str(executable.parent), start_new_session=True)
                self._send_json(200, {"ok": True, "message": f"Launch request sent: {executable.name}"})
            except Exception as exc:
                self._send_json(500, {"ok": False, "message": str(exc)})
            return

        self._send_json(404, {"ok": False, "message": "Unknown launcher action."})


def application_directory():
    # In a PyInstaller one-file build, sys._MEIPASS is a temporary extraction
    # directory. The actual executable and its sibling files live beside sys.executable.
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def application_executable():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve()
    return Path(__file__).resolve()


def main():
    lock = acquire_single_instance()
    if not lock:
        return

    server = None
    try:
        root = resource_directory()
        if not (root / "index.html").is_file():
            show_message(APP_NAME, "Application files are missing. Please reinstall the application.", True)
            return

        chrome = find_chrome()
        if not chrome:
            show_message(APP_NAME, "Google Chrome or Chromium was not found. Please install a supported browser and try again.", True)
            return

        try:
            with socket.create_connection((HOST, PORT), timeout=0.5):
                show_message(APP_NAME, f"Port {PORT} is already in use. Close the other application and try again.", True)
                return
        except OSError:
            pass

        handler = lambda *args, **kwargs: QuietHandler(*args, directory=str(root), **kwargs)
        server = ThreadingHTTPServer((HOST, PORT), handler)
        server.daemon_threads = True
        threading.Thread(target=server.serve_forever, daemon=True).start()

        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        url = f"http://{HOST}:{PORT}/"
        command = [
            chrome,
            f"--user-data-dir={PROFILE_DIR}",
            f"--app={url}",
            "--no-first-run",
            "--disable-background-mode",
            "--disable-features=Translate",
        ]

        try:
            browser = subprocess.Popen(command, close_fds=(sys.platform != "win32"))
            # Dedicated browser profile keeps LocalStorage persistent between launches.
            browser.wait()
        except Exception as exc:
            show_message(APP_NAME, f"Unable to launch Chrome/Chromium:\n{exc}", True)
    finally:
        if server:
            server.shutdown()
            server.server_close()
        release_single_instance(lock)


if __name__ == "__main__":
    main()
