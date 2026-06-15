# Mission Agent — Concept & Vision Guide

> **Working title:** *Mission Agent* (name to be finalized).
> An AI-native mission design and orbit analysis platform — built on NASA's proven engine, driven by natural language.

---

## 1. The One-Line Idea

Designing a spacecraft mission today requires expert-level astrodynamics knowledge, fluency in an arcane scripting language, and patience for a dated desktop interface. **Mission Agent collapses all of that into a sentence.** You describe what you want — *"design a 550 km sun-synchronous orbit and tell me the deorbit delta-v"* — and the platform produces the analysis, the numbers, and a live 3D visualization, while showing its work every step of the way.

It is, in spirit, *"Claude Code for mission design."*

---

## 2. The Problem We're Solving

Open-source and commercial mission design tools (GMAT, STK, FreeFlyer, Orekit) are extraordinarily capable. They compute flight-quality orbital mechanics trusted by real space missions. But they share three barriers that lock out everyone except trained specialists:

**The expertise barrier.** To answer even a simple question — "how often can my satellite see this ground station?" — you must understand orbital elements, force models, coordinate frames, propagators, and event geometry. The knowledge required to *ask* the question correctly is itself the hard part.

**The interface barrier.** These tools were designed around dense, decades-old graphical interfaces or text-based scripting languages with steep, unforgiving syntax. A single misplaced field stops the entire analysis. On some platforms — notably macOS — the experience is meaningfully worse than on others.

**The cost barrier.** The polished commercial options cost tens of thousands of dollars per seat. The free options trade that cost for a brutal learning curve.

The result: a fast-growing population of smallsat startups, university CubeSat teams, and individual builders who need mission analysis but cannot justify a specialist hire, an expensive license, or weeks spent learning a legacy tool.

---

## 3. What We Are Building (and What We Are Not)

**We are not rebuilding the orbital mechanics engine.** Reimplementing twenty years of validated, flight-proven astrodynamics would take years and would never earn the trust that the existing engine already has. That is a trap, and we are deliberately avoiding it.

**We are building the interface, the intelligence, and the experience on top of a proven engine.** The platform wraps NASA's General Mission Analysis Tool (GMAT) — an open-source, Apache-licensed, flight-validated engine — and runs it invisibly in the background. The user never sees GMAT. They see *our* tool: a clean, modern, AI-driven workspace.

This is the same pattern that made modern developer tools successful. They did not rebuild compilers or version control — they put an intelligent layer on top of tools that already worked. The engine becomes an implementation detail. The product is everything around it.

| | Approach |
|---|---|
| **The engine (correctness)** | Reused, untouched — proven flight heritage for free |
| **The interface (experience)** | Rebuilt entirely — modern, AI-first, visual |
| **The intelligence (the wedge)** | New — natural language in, verified analysis out |

---

## 4. The Core Concept: How It Works

### The three modes of mission design

Every mission design tool, underneath its interface, organizes work into three conceptual areas. Understanding these is the key to understanding our product:

- **Resources — the *nouns*.** The objects that exist in a mission: the spacecraft, its orbit, the propagator and force model, maneuvers, ground stations, coordinate systems.
- **Mission Sequence — the *verbs*.** An ordered list of commands that actually execute: propagate forward, apply a maneuver, solve for a target condition, generate a report. This is the real *program* of the mission.
- **Output — the *results*.** The rendered outcome: 3D orbit views, ground tracks, data reports, and plots.

Our platform honors this model but transforms each part into something modern, visual, and — crucially — controllable through conversation.

### The single source of truth

Underneath everything sits one artifact: the mission script. This is the elegant core of the design.

- The **AI** writes and edits the script from natural language.
- The **visual panels** (resource forms, the sequence timeline) read and edit the same script.
- The **engine** runs it.
- The **output panels** render what it produces.

Because both the AI and the hand-editable panels compile down to the same underlying script, they never conflict. They are simply two different editors over one document. You can describe a change in words, or adjust it by hand, and both stay perfectly in sync.

### The interaction loop

1. The user expresses an intent in plain language.
2. The AI agent interprets it, selects from a library of validated mission templates, and assembles a script.
3. Before running, the script passes through sanity and physics guardrails.
4. The engine executes it headlessly.
5. Results are parsed, validated again, visualized on a 3D globe and ground track, and explained back in plain language.
6. If something didn't converge or looks physically wrong, the agent notices and iterates.

---

## 5. The User Experience

The workspace is organized into four zones, with the AI assistant always present:

- **Resources panel** — an inspector for the mission's objects. Editable directly *or* by asking the assistant.
- **Output (center stage)** — a beautiful 3D globe showing the orbit, a 2D ground track, data reports, and plots.
- **Mission Sequence** — a visible, editable timeline of the commands that will run. When the AI builds a complex multi-step maneuver, the user can see and trust each step.
- **AI Chat** — the primary way to drive everything: ask, refine, explain, iterate.

Beneath these sits a control bar to run, pause, and stop an analysis — and a **"View Script" toggle** that reveals the exact engine script the AI generated.

That transparency toggle is not a minor feature. It is central to the product's trustworthiness (see Principles below).

---

## 6. Initial Scope — The First Five Workflows

Rather than trying to wrap the entire surface of a twenty-year-old tool, the first version focuses on the five workflows that cover the overwhelming majority of what the target audience actually needs:

1. **Orbit design** — define and visualize an orbit from intent ("sun-synchronous at 600 km").
2. **Propagation** — evolve an orbit forward in time under realistic forces.
3. **Ground station contact analysis** — when and how often a satellite passes over a location.
4. **Maneuver planning** — compute the burns to change or transfer between orbits.
5. **Deorbit & lifetime** — how long until reentry, and the delta-v to deorbit deliberately.

These five are the foundation. The architecture is designed so that new capabilities are added by contributing a new validated template and tool — not by rewriting the core.

---

## 7. Architecture in Plain Language

The platform is deliberately **local-first**. It runs entirely on the user's own machine as a single application. Everything works offline — designing orbits, running analyses, viewing results — with exactly one exception: the AI assistant requires an internet connection to reason. That single dependency is isolated in one place, so a fully-offline mode (using a local model) remains possible later as a graceful fallback.

Conceptually there are three layers:

- **The engine layer** runs the proven orbital mechanics in the background and is never modified. Upgrading it is as simple as pointing at a new version.
- **The intelligence layer** is the AI agent: it translates intent into mission scripts, runs them, checks the results for physical sanity, and explains them.
- **The experience layer** is the visual workspace the user actually touches — the panels, the globe, the chat.

A small local database remembers missions and history. Each analysis runs in its own isolated workspace folder, so results are always inspectable and runs can never interfere with one another or with the rest of the system.

---

## 8. What Makes It Defensible

The visible interface is the easiest thing for a competitor to copy. The real, durable advantages lie deeper:

**The validated template and prompt library.** AI models, left alone, will confidently produce incorrect engine scripts. The genuine work — and the moat — is a curated, tested library of mission templates and the prompt engineering that drives them reliably. This asset compounds over time and is hard to replicate.

**Transparency as a feature.** Aerospace users will never accept "the AI said so." Every answer shows the exact script that ran and the exact numbers it produced. Trust is built by making the work visible, not by hiding it. This is a deliberate product stance, not an afterthought.

**Physics guardrails.** The most dangerous failure in an AI-driven analysis tool is not a crash — it's a wrong answer delivered with confidence. Sanity checks before and after every run are what separate a trustworthy tool from a plausible-sounding one.

**A genuinely modern experience.** A clean, fast, visual workspace built on current technology immediately feels a generation ahead of the incumbent interfaces — particularly on platforms the legacy tools have neglected.

---

## 9. Who It's For

The wedge audience is intentionally *not* large government space agencies with their own specialists. It is:

- **University CubeSat and smallsat teams** who need real mission analysis but have no dedicated astrodynamicist.
- **Smallsat and NewSpace startups** who cannot justify a five-figure software license or a specialist hire early on.
- **Students and learners** who want to understand orbital mechanics by exploring it conversationally, not by fighting syntax.
- **Engineers in adjacent fields** who occasionally need mission analysis without becoming experts.

These users adopt quickly, share enthusiastically, and are underserved by everything currently on the market.

---

## 10. Guiding Principles

1. **Reuse the engine; rebuild the experience.** Correctness comes from proven software. Uniqueness comes from the interface, the intelligence, and the design.
2. **The script is the single source of truth.** Every part of the system reads from and writes to one underlying artifact.
3. **Show the work, always.** Transparency is the foundation of trust in a technical domain.
4. **Guard against confident wrongness.** Validate inputs and outputs; never let the assistant present unchecked results as fact.
5. **Local-first, offline-capable.** The internet is required only for the AI, and that dependency is isolated.
6. **Grow by adding data, not rewriting code.** New capabilities arrive as new templates and tools, keeping the core stable.
7. **Start narrow, go deep.** Five workflows done excellently beat fifty done poorly.

---

## 11. Build Roadmap

The development sequence is ordered so that the most valuable, demonstrable result comes first, and the hardest pieces come last:

**Phase 1 — Engine foundation.** Confirm the engine runs headlessly and can execute a mission script and return results. *(Complete.)*

**Phase 2 — The demo.** Build the output visualization and the AI chat so a user can type a sentence and watch an orbit appear with explained numbers. This single demonstration is the product's pitch, landing page, and proof of concept all at once.

**Phase 3 — The intelligence.** Mature the AI agent loop, the template library, and the guardrails until script generation is reliable.

**Phase 4 — Direct control.** Add the Resources inspector so objects can be edited by hand, not just by conversation.

**Phase 5 — The sequence editor.** Add the editable Mission Sequence timeline — the most complex surface, and the one users need last.

---

## 12. Glossary

- **Engine** — the background software that performs the actual orbital mechanics calculations.
- **Mission script** — the underlying text artifact describing a complete mission; the single source of truth.
- **Resources** — the objects in a mission (spacecraft, orbit, propagator, maneuvers, ground stations).
- **Mission Sequence** — the ordered list of commands that execute when a mission runs.
- **Propagator** — the component that evolves an orbit forward through time under physical forces.
- **Force model** — the set of physical effects considered (gravity, atmospheric drag, solar pressure, other bodies).
- **Ground track** — the path a satellite traces over the Earth's surface.
- **Delta-v** — the change in velocity a maneuver requires; the currency of mission planning.
- **The agent** — the AI layer that interprets intent, drives the engine, validates results, and explains them.

---

*This document describes the concept and intent of the platform. It is a living guide and will evolve as the project develops.*
