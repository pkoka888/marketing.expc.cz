# Project Debug Rules (Non-Obvious Only)

- Application logs written to `app_logs.txt`, docker logs to `docker_logs.txt`, MCP logs to `mcp_logs.txt` (not standard console.log)
- Agent interaction logs stored in `.cline/logs/*.jsonl` - check these for orchestration issues
- Dev server runs on port 3002 with host 0.0.0.0, but Playwright tests expect localhost:3000 - port mismatch causes test failures
- GEMINI_API_KEY must be set in environment for AI features to work (injected via Vite define, not runtime fetch)
- Context state in `.cline/context/SUMMARY.md` becomes stale - refresh before debugging integration issues
- File writes to `.cline/` directories must use `safe-fs.js` or risk silent corruption
- Orchestration failures logged in `.cline/logs/` with JSON structure - parse for mode transition errors