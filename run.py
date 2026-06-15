#!/usr/bin/env python3
"""Single entry point: optionally build the web app, then launch the server."""
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
WEB_DIR = ROOT / "web"
WEB_DIST = WEB_DIR / "dist"


def build_web() -> None:
    if not WEB_DIST.exists():
        print("Building web app…")
        subprocess.run(["npm", "install"], cwd=WEB_DIR, check=True)
        subprocess.run(["npm", "run", "build"], cwd=WEB_DIR, check=True)
        print("Web build complete.")


def open_browser_after(url: str, delay: float = 1.8) -> None:
    def _open():
        time.sleep(delay)
        webbrowser.open(url)

    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    build_web()

    import yaml

    cfg = yaml.safe_load((ROOT / "config.yaml").read_text())
    host = cfg["server"]["host"]
    port = cfg["server"]["port"]
    url = f"http://{host}:{port}"

    print(f"\n  Mission Agent  →  {url}\n")
    open_browser_after(url)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "server.main:app",
            "--host",
            host,
            "--port",
            str(port),
            "--reload",
        ],
        cwd=ROOT,
    )


if __name__ == "__main__":
    main()
