# Maintenance Rules

## 1. Archival Policy

- **Logs**: Move `.cline/logs/*.jsonl` to `.cline/archive/logs/` if they are older than 7 days.
- **Plans**: If all tasks in `plans/plan.md` are marked `[x]`, rename it to `plans/completed/plan-YYYY-MM-DD.md` and create a blank one.
- **Tasks**: Start a new `task.md` if the current one is > 90% complete.

## 2. Documentation Sync

- **Tech Stack**: If `package.json` changes (new dependency), check if `agent.md` needs an update.
- **File Structure**: If a major directory is moved, update `agent.md` Project Map.
- **Dead Links**: occasional scan for broken markdown links.

## 3. Context Health

- **Summary**: Ensure `.cline/context/SUMMARY.md` is not too large (> 50 lines). If so, summarize it further.
