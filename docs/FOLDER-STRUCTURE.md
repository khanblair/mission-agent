mission-agent/
├── run.py                          # single entry: builds web (if needed), launches FastAPI, opens browser
├── config.yaml                     # GMAT path, model name, ports — non-secret settings
├── .env                            # API keys ONLY — gitignored
├── .env.example                    # documents .env shape — safe to commit
├── .gitignore
├── pyproject.toml                  # Python deps + tooling (ruff), uv-managed
├── README.md
│
├── server/                         # ───── Python: engine + agent + API ─────
│   ├── main.py                     # FastAPI app, static mount, route + WS wiring
│   ├── config.py                   # loads config.yaml + .env → one typed settings object
│   ├── db.py                       # SQLite: connection, schema, migrations
│   │
│   ├── engine/                     # ONLY code that touches GMAT
│   │   ├── gmat_engine.py          # ✓ done — loads engine once per process
│   │   ├── gmat_runner.py          # ✓ ready — script in → run headless → outputs
│   │   ├── object_model.py         # read/write resource fields (feeds inspector panels)
│   │   ├── report_parser.py        # GMAT report text → structured tables
│   │   ├── groundtrack.py          # ephemeris → lat/lon track (2D map)
│   │   └── czml_converter.py       # ephemeris → CZML (Cesium 3D)
│   │
│   ├── agent/                      # the AI layer
│   │   ├── loop.py                 # ReAct cycle: plan → act → observe → respond
│   │   ├── tools.py                # tool defs: run_script, edit_resource, validate, parse…
│   │   ├── llm.py                  # LLM client — THE one online module, isolated
│   │   └── validators.py           # physics/sanity guardrails, before + after a run
│   │
│   ├── routes/                     # thin HTTP/WS — wiring only, no logic
│   │   ├── chat.py                 # WS: user msg → agent → streamed reply
│   │   ├── missions.py             # CRUD: list/load/save missions (SQLite)
│   │   └── engine.py               # run script, fetch outputs, read/write resources
│   │
│   ├── templates/                  # ★ moat — validated GMAT scripts as DATA
│   │   ├── leo_propagate.script    # ✓ ready
│   │   ├── ground_contact.script
│   │   ├── hohmann_transfer.script
│   │   ├── sunsync_design.script
│   │   ├── deorbit_lifetime.script
│   │   └── manifest.yaml           # when to use each + required params
│   │
│   └── prompts/                    # agent prompts as files, not hardcoded
│       ├── system.md
│       └── script_gen.md
│
├── web/                            # ───── React + Vite + Cesium ─────
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 # the 4-zone layout shell
│       ├── lib/                    # reusable non-visual logic
│       │   ├── api.ts              # one typed client for all backend calls
│       │   └── ws.ts               # WebSocket streaming hook
│       ├── components/             # dumb, reusable UI (Button, Panel, Tabs, Message)
│       └── features/               # smart, feature-scoped zones
│           ├── chat/               # AI agent panel (always on)
│           ├── resources/          # object inspector
│           │   ├── ResourceTree.tsx
│           │   └── inspectors/     # one small editor per object type
│           ├── sequence/           # Mission timeline (view/edit commands)
│           ├── output/             # results — tabbed
│           │   ├── OrbitView.tsx   # Cesium 3D
│           │   ├── GroundTrack.tsx # 2D map
│           │   └── ReportTable.tsx
│           ├── script/             # raw-script transparency panel ({} toggle)
│           └── controls/           # run / pause / stop bar
│
└── data/                           # gitignored — created at runtime
    ├── missions.db                 # SQLite
    └── workspaces/                 # per-run GMAT outputs, inspectable on disk
        └── <run-id>/               # script + reports + ephemeris + czml, isolated