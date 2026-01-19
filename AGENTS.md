# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Test Commands
- Development server runs on port 3002 (not standard 3000) with host 0.0.0.0 for container access
- Use `npm run dev` for development (starts Vite on port 3002)

## Code Style Guidelines
- Import alias `@/` resolves to project root (configured in tsconfig.json and vite.config.ts)
- TypeScript strict mode enabled with experimentalDecorators and useDefineForClassFields: false
- Prettier: single quotes, semicolons required, trailing commas ES5 style, 80 char width

## Custom Utilities
- `lib/kilo-code/` contains project-specific utilities: error-handling, logger, timeout-handler, retry, circuit-breaker, response-validator, history-manager, index
- Use `safe-fs.js` from `.cline/scripts/utils/` for atomic file writes to prevent corruption
- Gemini API key injected via Vite define (process.env.GEMINI_API_KEY)

## Project-Specific Conventions
- Orchestration framework uses Cline CLI with Kilo Code agents in specialized modes
- Context stored in `.cline/context/SUMMARY.md` - check before major changes
- Logs archived from `.cline/logs/` to `.cline/archive/logs/` after 7 days
- Plans moved to `plans/completed/` when all tasks marked complete

## Critical Gotchas
- MarketingPortal uses custom kilo-code library for infrastructure utilities
- Atomic writes required for critical state updates using safe-fs.js