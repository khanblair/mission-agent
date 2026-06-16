#!/usr/bin/env python3
"""Single entry point — starts backend (uvicorn) + frontend (vite) together."""
import signal
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
WEB_DIR = ROOT / "web"


def _npm_install_if_needed() -> None:
    if not (WEB_DIR / "node_modules").exists():
        print("Installing frontend deps…")
        subprocess.run(["npm", "install"], cwd=WEB_DIR, check=True)


def _open_browser(url: str, delay: float = 2.5) -> None:
    def _open():
        time.sleep(delay)
        webbrowser.open(url)
    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    import yaml

    cfg = yaml.safe_load((ROOT / "config.yaml").read_text())
    host = cfg["server"]["host"]
    port = cfg["server"]["port"]
    api_url = f"http://{host}:{port}"
    ui_url = "http://localhost:5173"

    _npm_install_if_needed()

    print(f"\n  Backend  →  {api_url}")
    print(f"  Frontend →  {ui_url}\n")

    # Start Vite dev server in the background
    vite = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=WEB_DIR,
    )

    # Start uvicorn in the background (as a thread-friendly subprocess)
    uvicorn = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "server.main:app",
            "--host", host,
            "--port", str(port),
            "--reload",
        ],
        cwd=ROOT,
    )

    _open_browser(ui_url)

    # Shut both down cleanly on Ctrl-C
    def _shutdown(sig, frame):
        print("\nShutting down…")
        vite.terminate()
        uvicorn.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Wait — if either process dies unexpectedly, kill the other
    while True:
        if vite.poll() is not None:
            print("Vite exited unexpectedly.")
            uvicorn.terminate()
            sys.exit(1)
        if uvicorn.poll() is not None:
            print("Uvicorn exited unexpectedly.")
            vite.terminate()
            sys.exit(1)
        time.sleep(1)


if __name__ == "__main__":
    main()
