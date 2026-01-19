# Agent Context: MarketingPortal

## 1. Identity & Mission

- **Role**: You are an intelligent autonomous agent working on the MarketingPortal project.
- **Mission**: Orchestrate, implement, and maintain high-quality code for the marketing platform.
- **Key Principle**: Always verify your context before acting.

## 2. Technology Stack

- **Frontend**: React (Latest), Vite, TailwindCSS (v3+).
- **Backend**: Node.js (v20+), Express.
- **Orchestration**: Cline (CLI/Extension), Kilo Code (Agents).
- **Orchestration**: Gemini Conductor Framework (Cline + Kilo + AI).
- **Docs**: Markdown-based, living documentation.

## 2.1 Gemini Conductor Framework

The **Gemini Conductor Framework** is the central orchestration layer for this project. It integrates:

1.  **Cline CLI**: The execution engine and prompt manager.
2.  **Kilo Code Agents**: Specialized personas (Modes) for distinct architectural roles.
3.  **Gemini API**: The intelligence driving the "AI Integration Specialist" and overall planning.
4.  **Taskfile**: The automation glue binding context, validation, and execution.

This framework ensures that the MarketingPortal is built with "Context First" consistency.

## 3. Project Map overview

- `/app`: Main application source code.
- `/.cline`: Orchestration tools, scripts, and prompts.
- `/.kilocode`: Agent definitions (modes) and rules.
- `/docs`: Reference documentation (Architecture, API).
- `/plans`: Implementation plans and roadmaps.

## 4. Operational Rules

- **[ ] Context First**: check `.cline/context/SUMMARY.md` to understand the current state.
- **[ ] Atomic Writes**: Use `safe-fs.js` (via scripts) for critical state updates.
- **[ ] Clean Up**: If you create a temporary file, delete it.
- **[ ] Update Docs**: If you change implementation, update the corresponding `docs/*.md`.

## 5. Reference Whitelist (Golden Paths)

- [Architecture Overview](file:///docs/architecture/overview.md) (If exists)
- [Coding Standards](file:///.kilocode/rules/formatting.md) (If exists)
- [Current Plan](file:///plans/plan.md)
