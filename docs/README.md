# MarketingPortal - Core Documentation

## Project Overview
MarketingPortal is a React-based marketing application designed for professional marketing teams. Built with modern technologies for scalability from 20 to 1000+ users.

## Architecture Overview
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: PostgreSQL + Redis (planned)
- **Deployment**: Docker Compose (scalable to Kubernetes)
- **Testing**: Playwright E2E + Component testing
- **AI Integration**: Gemini API for intelligent features

## Quick Start
```bash
# Development setup
npm install
npm run dev

# Testing
npx playwright test

# Production build
npm run build
```

## Core Principles
- **Scalability First**: Architecture designed for 1000x growth
- **Quality Assurance**: 80%+ test coverage, strict TypeScript
- **Developer Experience**: Modern tooling, automated workflows
- **Security**: Input validation, secure defaults

## Roadmap Status
See `plans/plan.md` for detailed implementation roadmap and current status.

## Documentation Structure
- `architecture/`: System design and decisions
- `development/`: Setup and contribution guides
- `api/`: API documentation and schemas
- `deployment/`: Infrastructure and deployment guides