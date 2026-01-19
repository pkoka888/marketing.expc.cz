# Project Coding Rules (Non-Obvious Only)

- Use `safeWriteJson()` from `.cline/scripts/utils/safe-fs.js` instead of `fs.writeFile` for critical state updates to prevent corruption
- Always use utilities from `lib/kilo-code/` for error handling, retry logic, circuit breakers, and response validation (mandatory for infrastructure utilities)
- Import alias `@/` resolves to project root - use for all internal imports to maintain consistency
- Gemini API key accessed via `process.env.GEMINI_API_KEY` (injected by Vite, not from .env files)
- Playwright tests run against localhost:3000 but dev server on 3002 - ensure port alignment when modifying configs
- Context in `.cline/context/SUMMARY.md` must be checked before implementing features to maintain "Context First" consistency
- Atomic writes required for all `.cline/` files using safe-fs.js to prevent state corruption