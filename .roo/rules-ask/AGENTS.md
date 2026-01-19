# Project Documentation Rules (Non-Obvious Only)

- `.cline/` directory contains orchestration tools and AI agent prompts, not just CLI utilities
- `.roo/rules-*/` directories contain mode-specific AGENTS.md files for specialized AI guidance
- Context stored in `.cline/context/SUMMARY.md` provides current project state - essential for understanding phase
- Gemini Conductor Framework integrates Cline CLI, Kilo Code agents, and Gemini API for AI-assisted development
- Phase-based prompts in `.cline/prompts/phases/` determine available actions and suggestions
- Agent orchestration modes defined in `.kilocode/modes.yaml` with specialized capabilities
- Maintenance rules in `.kilocode/rules/maintenance.md` govern log archival and plan completion
- Taskfile.yml automates agent orchestration, logging, and validation workflows