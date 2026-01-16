# Local Development Environment Setup with Docker Compose

## Overview
This setup uses Docker Compose to create a local development environment that replicates the remote deployment of the marketing project. It runs the Vite development server in a Node.js container with live code mounting for hot reloading.

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  app:
    image: node:18
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run dev"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
```

## Prerequisites
- Docker and Docker Compose installed on your system
- `.env` file in the project root with `GEMINI_API_KEY` set

## Instructions
1. Ensure Docker is running
2. Set your Gemini API key in a `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. Run the development environment:
   ```
   docker-compose up
   ```
4. Access the application at `http://localhost:3000`

## Comparison: Docker vs WSL

### Docker
- **Pros**: Isolated containerized environment, consistent with remote deployments (assuming remote uses containers), easy to share setup across team, no host system pollution
- **Cons**: Requires Docker installation, slight performance overhead
- **Recommendation**: Preferred for this project due to consistency with remote setup and portability

### WSL (Windows Subsystem for Linux)
- **Pros**: Native Linux environment on Windows, good for development if you need Linux tools
- **Cons**: Not containerized, potential differences from remote environment, harder to replicate exact setup
- **Recommendation**: Not recommended for this project as it may not match the remote deployment consistency

## Remote Deployment Replication
The local setup runs the Vite development server, which provides hot reloading and development features. The remote deployment likely serves the built production files, but this local environment allows for development parity.