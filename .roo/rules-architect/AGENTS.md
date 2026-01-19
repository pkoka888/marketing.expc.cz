# Project Architecture Rules (Non-Obvious Only)

- "Context First" principle requires checking `.cline/context/SUMMARY.md` before any architectural decisions
- Gemini Conductor Framework orchestrates Cline CLI, Kilo Code modes, and Gemini API - decisions must align with this
- Current phase "setup" limits scope to frontend only - backend Express/PostgreSQL planned but not implemented
- Scalability designed for 1000+ users with Docker Compose → Kubernetes migration path
- Atomic writes using `safe-fs.js` mandatory for all `.cline/` state updates to prevent corruption
- MCP servers (GitHub, monitoring, PostgreSQL, Redis) provide infrastructure integration but require Docker
- Taskfile.yml automates orchestration workflows - architecture must support automated validation
- Maintenance rules require log archival after 7 days and plan completion tracking
- Agent modes have strict file restrictions - architect mode limited to `.md` files only