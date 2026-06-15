"""Engine routes — run scripts and fetch structured outputs."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..db import get_db, new_id, row_to_dict
from ..engine.czml_converter import czml_to_json, ephemeris_to_czml
from ..engine.groundtrack import ephemeris_to_groundtrack, split_groundtrack_segments
from ..engine.gmat_engine import is_mock
from ..engine.gmat_runner import run_script
from ..engine.object_model import parse_script
from ..engine.report_parser import (
    parse_ephemeris,
    parse_orbit_elements,
    summarize_orbit,
)

router = APIRouter()


class RunRequest(BaseModel):
    script: str
    mission_id: str | None = None


@router.get("/status")
async def engine_status() -> dict[str, Any]:
    from ..engine.gmat_engine import load_engine

    real = load_engine()
    return {
        "mode": "real" if real else "mock",
        "gmat_path": settings.gmat_path,
    }


@router.post("/run")
async def run_mission(body: RunRequest) -> dict[str, Any]:
    try:
        result = await run_script(body.script)
    except Exception as exc:
        raise HTTPException(500, str(exc))

    # Parse outputs
    eph = parse_ephemeris(result.ephemeris_path)
    elements = parse_orbit_elements(result.orbit_elements_path)
    summary = summarize_orbit(elements)
    groundtrack = ephemeris_to_groundtrack(eph[:1440])  # cap at 1440 points for perf
    gt_segments = split_groundtrack_segments(groundtrack)
    czml = ephemeris_to_czml(eph[:720])  # ~12 hrs of 1-min steps for 3D view

    result_data = {
        "run_id": result.run_id,
        "mock": result.mock,
        "orbit_summary": summary,
        "groundtrack_segments": gt_segments,
        "czml": czml,
        "elements_sample": elements[:5] if elements else [],
    }

    # Persist run
    run_id = new_id()
    async with get_db() as db:
        await db.execute(
            """INSERT INTO runs (id, mission_id, status, script, output_dir, result_json, completed_at)
               VALUES (?, ?, 'completed', ?, ?, ?, datetime('now'))""",
            (
                run_id,
                body.mission_id,
                body.script,
                str(result.output_dir),
                json.dumps(result_data),
            ),
        )
        await db.commit()

    result_data["db_run_id"] = run_id
    return result_data


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    async with get_db() as db:
        async with db.execute("SELECT * FROM runs WHERE id = ?", (run_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Run not found")
    data = row_to_dict(row)
    if data.get("result_json"):
        data["result"] = json.loads(data["result_json"])
    return data


@router.get("/templates")
async def list_templates() -> list[dict[str, Any]]:
    import yaml

    manifest_path = settings.templates_dir / "manifest.yaml"
    if not manifest_path.exists():
        return []
    manifest = yaml.safe_load(manifest_path.read_text())
    return manifest.get("templates", [])


@router.get("/templates/{template_id}")
async def get_template(template_id: str) -> dict[str, Any]:
    import yaml

    manifest_path = settings.templates_dir / "manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text())
    templates = {t["id"]: t for t in manifest.get("templates", [])}
    if template_id not in templates:
        raise HTTPException(404, "Template not found")
    tmpl = templates[template_id]
    script_path = settings.templates_dir / tmpl["file"]
    return {"id": template_id, "meta": tmpl, "script": script_path.read_text()}


@router.post("/parse-resources")
async def parse_resources(body: RunRequest) -> dict[str, Any]:
    resources = parse_script(body.script)
    return resources.to_dict()
