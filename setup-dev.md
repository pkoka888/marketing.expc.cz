# Development Environment Setup Guide

## Prerequisites
- Docker and Docker Compose installed
- VS Code with Dev Containers extension

## Environment Setup

### Node.js (LTS 20.x)
The dev container automatically installs Node.js 20.x using the Node feature.
For local development without Docker:
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install and use Node 20
nvm install 20
nvm use 20
nvm alias default 20
```

### Python (3.11+)
The dev container installs Python 3.11 using the Python feature.
For local setup:
```bash
# Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip
```

## Development Workflow

### 1. Open in Dev Container
1. Open the project in VS Code
2. When prompted, click "Reopen in Container" or use Command Palette: "Dev Containers: Reopen in Container"
3. The container will install all dependencies automatically

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create `.env.local` with:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start Development Server
```bash
npm run dev
```
Access at http://localhost:3000

### 5. Code Quality Tools
- **ESLint**: Configured for TypeScript and React
- **Prettier**: Automatic formatting on save
- **TypeScript**: Strict type checking enabled

### 6. Testing with Playwright
```bash
# Run tests
npx playwright test

# Run tests in UI mode
npx playwright test --ui

# Generate test report
npx playwright show-report
```

## CLI Tools Setup

### Kilo Code Integration
- Extension: `kilocode.kilo-code` (automatically installed in dev container)
- Model: Configured to use `x-ai/grok-code-fast-1`
- Modes: Custom modes defined in `.kilocodemodes`

### Claude CLI (Cline) Setup
```bash
# Install Claude CLI if needed
npm install -g @anthropic/claude-cli
# Configure with your Anthropic API key
```

## Best Practices

### Code Quality
- Use TypeScript for all new code
- Run ESLint before commits
- Follow Prettier formatting
- Write Playwright tests for new features

### Git Workflow
- Use descriptive commit messages
- Test locally before pushing
- Use branches for features

### Performance
- Use React DevTools for profiling
- Monitor bundle size with `npm run build`
- Optimize images and assets

## Troubleshooting

### Common Issues
- **Port conflicts**: Ensure port 3000 is available
- **Node version**: Use Node 20.x as specified
- **Python venv**: Always activate virtual environment for Python scripts

### Dev Container Issues
- Rebuild container: "Dev Containers: Rebuild Container"
- Check logs: View terminal output during build

## Framework Recommendations

Based on research of parallel React development frameworks:

### Selected Framework: Gemini Conductor
**Why chosen:**
- Native integration with Gemini API (already used in project)
- Supports structured workflow protocols for parallel development
- Excellent AI-assisted coding capabilities
- Seamless Playwright testing integration
- Proven in expert communities for React app development

**Integration:**
- Use Gemini Conductor for planning and parallel implementation
- Combine with Kilo Code modes for specialized development tasks
- Leverage Playwright for automated testing in parallel workflows

### Alternative Options Evaluated
- **GitHub Spec-Kit**: Good for specification generation but less AI-assisted
- **Bolt.new**: Excellent AI coding but limited parallel development features
- **v0 (Vercel)**: Strong UI generation but not optimized for full app development

This setup provides a comprehensive, scalable development environment for the MarketingPortal app.