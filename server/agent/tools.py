"""Tool definitions and executors for the agent ReAct loop."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import yaml

from ..config import settings
from ..engine.gmat_runner import run_script as engine_run
from ..engine.object_model import parse_script
from ..engine.report_parser import parse_ephemeris, parse_orbit_elements, summarize_orbit
from ..engine.groundtrack import ephemeris_to_groundtrack, split_groundtrack_segments
from ..engine.czml_converter import ephemeris_to_czml
from .validators import validate_script, validate_results, sso_inclination, hohmann_dv

# ── Tool schemas (OpenAI / DeepSeek function-calling format) ──────────────────

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_template",
            "description": "Retrieve a validated GMAT script template by workflow ID. Use this before generating a script to get the correct structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "template_id": {
                        "type": "string",
                        "enum": ["leo_propagate", "sunsync_design", "ground_contact", "hohmann_transfer", "deorbit_lifetime"],
                        "description": "Which template to retrieve",
                    }
                },
                "required": ["template_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "validate_script",
            "description": "Check a GMAT script for physics errors and structural issues before running it. Always call this before run_script.",
            "parameters": {
                "type": "object",
                "properties": {
                    "script": {"type": "string", "description": "The GMAT script to validate"}
                },
                "required": ["script"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_script",
            "description": "Execute a GMAT script and return orbit data, ground track, and 3D visualization data. Only call after validate_script returns ok=true.",
            "parameters": {
                "type": "object",
                "properties": {
                    "script": {"type": "string", "description": "The validated GMAT script to run"}
                },
                "required": ["script"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compute_sso_inclination",
            "description": "Compute the sun-synchronous inclination for a given circular orbit altitude using the J2 nodal precession formula.",
            "parameters": {
                "type": "object",
                "properties": {
                    "altitude_km": {"type": "number", "description": "Circular orbit altitude in km"}
                },
                "required": ["altitude_km"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compute_hohmann_dv",
            "description": "Compute the delta-v for a Hohmann transfer between two circular orbits.",
            "parameters": {
                "type": "object",
                "properties": {
                    "initial_altitude_km": {"type": "number"},
                    "target_altitude_km": {"type": "number"},
                },
                "required": ["initial_altitude_km", "target_altitude_km"],
            },
        },
    },
]


# ── Tool executors ─────────────────────────────────────────────────────────────

async def execute_tool(name: str, input_data: dict[str, Any]) -> dict[str, Any]:
    if name == "get_template":
        return _get_template(input_data["template_id"])
    elif name == "validate_script":
        return _validate(input_data["script"])
    elif name == "run_script":
        return await _run(input_data["script"])
    elif name == "compute_sso_inclination":
        return _sso(input_data["altitude_km"])
    elif name == "compute_hohmann_dv":
        return _hohmann(input_data["initial_altitude_km"], input_data["target_altitude_km"])
    else:
        return {"error": f"Unknown tool: {name}"}


def _get_template(template_id: str) -> dict[str, Any]:
    manifest_path = settings.templates_dir / "manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text())
    templates = {t["id"]: t for t in manifest.get("templates", [])}
    if template_id not in templates:
        return {"error": f"Template '{template_id}' not found"}
    tmpl = templates[template_id]
    script_path = settings.templates_dir / tmpl["file"]
    return {"template_id": template_id, "description": tmpl["description"], "script": script_path.read_text()}


def _validate(script: str) -> dict[str, Any]:
    result = validate_script(script)
    return result.to_dict()


async def _run(script: str) -> dict[str, Any]:
    result = await engine_run(script)
    eph = parse_ephemeris(result.ephemeris_path)
    elements = parse_orbit_elements(result.orbit_elements_path)
    summary = summarize_orbit(elements)
    groundtrack = ephemeris_to_groundtrack(eph[:1440])
    gt_segments = split_groundtrack_segments(groundtrack)
    czml = ephemeris_to_czml(eph[:720])
    validation = validate_results(summary, groundtrack)

    return {
        "run_id": result.run_id,
        "mock": result.mock,
        "orbit_summary": summary,
        "groundtrack_segments": gt_segments,
        "czml": czml,
        "validation": validation.to_dict(),
        "elements_sample": elements[:3] if elements else [],
    }


def _sso(altitude_km: float) -> dict[str, Any]:
    try:
        inc = sso_inclination(altitude_km)
        period_min = 2 * math.pi * math.sqrt(((6371 + altitude_km) ** 3) / 398600.4418) / 60
        return {
            "altitude_km": altitude_km,
            "sso_inclination_deg": round(inc, 4),
            "sma_km": round(6371 + altitude_km, 2),
            "period_min": round(period_min, 2),
        }
    except ValueError as e:
        return {"error": str(e)}


def _hohmann(r1: float, r2: float) -> dict[str, Any]:
    return hohmann_dv(r1, r2)
