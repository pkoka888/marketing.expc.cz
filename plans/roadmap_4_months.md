# MarketingPortal Roadmap & Orchestration Guide

> **Strategy**: 4-Month "Gemini Conductor" Execution Plan

## Orchestration Philosophy: The Gemini Conductor

This project is driven by the **Gemini Conductor Framework**, a centralized orchestration model where:

1.  **Context is King**: No code is written without a loaded Scenario (via `.cline/context-loader.yaml`).
2.  **Agents are Specialized**: We use specific Kilo Modes (`frontend-engineer`, `backend-engineer`) for execution.
3.  **Validation is Automated**: Every phase transition is gated by `Taskfile` checks.

## 📅 Month 1: Foundation & "Conductor" Setup

**Goal**: Establish the "Conductor" framework and Core Dashboard Skeleton.

- **Values & inconsistencies fixed**:
  - Unified `.cline` and `.kilocode` context (Fixed `[object Object]` bug).
  - Established `agent.md` as the single source of truth for the Conductor.

**Weeks 1-2: Orchestration Hardening**

- [ ] **Verify CI/CD**: Ensure `.cline/workflows/ci-cd-triggers.json` actually triggers GitHub Actions (or simulates them).
- [ ] **Context Loading**: Test `task context SCENARIO=planning` vs `SCENARIO=debugging`.
- [ ] **Agent Drills**: Run a mock task with each Kilo mode to verify `modes.yaml` behavior.

**Weeks 3-4: Dashboard Core (Frontend)**

- [ ] **App Shell**: Implement Sidebar, Topbar, and Theme Provider (React 19/Tailwind).
- [ ] **Routing**: Setup `tanstack-router` or `react-router` with code splitting.
- [ ] **Auth UI**: Login/Register pages (UI only first).
- _Agent Mode_: `frontend-engineer`

## 📅 Month 2: Connectivity & Data Layer

**Goal**: Connect Frontend to Internal Tools and Mock Backend.

**Weeks 5-6: Data Architecture**

- [ ] **Schema Design**: PostgreSQL schema for Users, Campaigns, Analytics.
- [ ] **Mock Server**: Setup `msw` or a simple Express mock for frontend velocity.
- [ ] **State Management**: Implement `zustand` or `tanstack-query` for server state.
- _Agent Mode_: `backend-engineer` & `architect-orchestrator`

**Weeks 7-8: Internal Tools Integration**

- [ ] **Dashboard Widgets**: Connect "Project Health" widget to `.cline/context/current-phase.json` (Visualize the agent state!).
- [ ] **Log Viewer**: Build a UI component to stream `.cline/logs` into the web app (Admin only).
- _Agent Mode_: `frontend-engineer`

## 📅 Month 3: Deep AI Integration (Gemini)

**Goal**: Implement the "Smart" features using Gemini.

**Weeks 9-10: Gemini API Core**

- [ ] **Server-Side Integration**: Node.js wrapper for Gemini API (Streaming, Function Calling).
- [ ] **Prompt Registry**: Move hardcoded prompts to a database or dynamic registry.
- _Agent Mode_: `backend-engineer` & `ai-integration-specialist`

**Weeks 11-12: AI Features**

- [ ] **Content Generator**: "Write a Blog Post" feature for the Marketing Portal.
- [ ] **Campaign Planner**: AI suggestion engine for marketing strategies.
- [ ] **Auto-Tagger**: Analyze text/images and auto-tag content.
- _Agent Mode_: `ai-integration-specialist`

## 📅 Month 4: Polish, Optimization & Launch

**Goal**: Production readiness and Scale.

**Weeks 13-14: Performance & QA**

- [ ] **E2E Testing**: Full Playwright coverage (User flows, AI failures).
- [ ] **Optimization**: Component lazy loading, image optimization, edge caching.
- [ ] **Security Audit**: Review API endpoints and AI prompt injection risks.
- _Agent Mode_: `qa-engineer` & `devops-engineer`

**Weeks 15-16: Launch Sequence**

- [ ] **Documentation**: Finalize `/docs` (User Manual, Developer Guide).
- [ ] **Deployment**: Dockerize and deploy to Staging/Production.
- [ ] **Handover**: "Janitor" run to clean up temp files.
- _Agent Mode_: `devops-engineer`

## Orchestration Notes for User

- **Daily Routine**:
  1. `task context SCENARIO=default` (Refresh context)
  2. `task orchplan` (See what's next)
  3. `task suggest` (Get prompt for the agent)
- **Weekly Review**:
  1. Switch to `architect-orchestrator` mode.
  2. Review `plans/roadmap_4_months.md` vs actual progress.
  3. Update `agent.md` if rules change.
