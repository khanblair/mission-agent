"""GMAT engine singleton — loads once per process, exposes run interface."""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from ..config import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_engine_loaded: bool = False
_mock_mode: bool = False


def _find_gmat_bin() -> Path | None:
    candidates = [
        Path(settings.gmat_path) / "bin",
        Path("/Applications/GMAT/R2022a/bin"),
        Path("/Applications/GMAT/R2020a/bin"),
        Path(os.path.expanduser("~/GMAT/R2022a/bin")),
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def load_engine() -> bool:
    """Attempt to load the GMAT Python API. Falls back to mock if unavailable."""
    global _engine_loaded, _mock_mode

    if _engine_loaded:
        return not _mock_mode

    gmat_bin = _find_gmat_bin()
    if gmat_bin is None:
        if settings.gmat_mock_when_missing:
            logger.warning("GMAT not found — running in mock mode (Keplerian propagation).")
            _mock_mode = True
            _engine_loaded = True
            return False
        raise RuntimeError(
            f"GMAT not found at {settings.gmat_path}. "
            "Install GMAT or set gmat.mock_when_missing: true in config.yaml."
        )

    startup_file = gmat_bin / "gmat_startup_file.txt"
    if not startup_file.exists():
        logger.warning("GMAT startup file not found — falling back to mock mode.")
        _mock_mode = True
        _engine_loaded = True
        return False

    try:
        sys.path.insert(0, str(gmat_bin))
        import gmatpy as gmat  # type: ignore[import-not-found]

        gmat.Setup(str(startup_file))
        logger.info("GMAT engine loaded from %s", gmat_bin)
        _mock_mode = False
        _engine_loaded = True
        return True
    except Exception as exc:
        logger.warning("Failed to load GMAT Python API (%s) — falling back to mock.", exc)
        _mock_mode = True
        _engine_loaded = True
        return False


def is_mock() -> bool:
    if not _engine_loaded:
        load_engine()
    return _mock_mode
