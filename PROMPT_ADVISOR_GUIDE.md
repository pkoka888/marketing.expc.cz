# /prompt-advisor Slash Command Tool - User Guide

## Overview

The `/prompt-advisor` slash command tool provides intelligent prompt suggestions based on your current project state, roadmap progress, and conductor framework integration. It automatically analyzes your development phase and suggests the most relevant tasks for your agent modes.

## Quick Start

### Basic Usage
```bash
# Get next steps based on current project state
/prompt-advisor next-steps

# Get architecture phase specific suggestions
/prompt-advisor architecture-phase

# Get CI/CD setup suggestions
/prompt-advisor ci-cd-setup

# Get agent mode specific suggestions
/prompt-advisor agent-mode --agent=frontend-engineer
```

### Integration with Taskfile
```bash
# Use via Taskfile
task prompt-advisor COMMAND=next-steps OPTIONS="--priority=high"

# Auto-execute high-priority tasks
task next-steps AUTO_EXECUTE=true PRIORITY=high
```

## Commands

### 1. `next-steps`
**Purpose**: Get next steps based on current project state and phase
**Usage**: `/prompt-advisor next-steps [options]`
**Output**: Phase-specific suggestions with priorities and dependencies

**Example**:
```bash
/prompt-advisor next-steps --priority=high --format=markdown
```

### 2. `architecture-phase`
**Purpose**: Get architecture phase specific suggestions
**Usage**: `/prompt-advisor architecture-phase [options]`
**Best for**: System design, database schema, API specifications

**Example**:
```bash
/prompt-advisor architecture-phase --agent=architect-orchestrator
```

### 3. `implementation-phase`
**Purpose**: Get implementation phase specific suggestions
**Usage**: `/prompt-advisor implementation-phase [options]`
**Best for**: Code implementation, component development, integration

**Example**:
```bash
/prompt-advisor implementation-phase --priority=medium
```

### 4. `ci-cd-setup`
**Purpose**: Get CI/CD pipeline setup suggestions
**Usage**: `/prompt-advisor ci-cd-setup [options]`
**Best for**: Automation, testing, deployment pipelines

**Example**:
```bash
/prompt-advisor ci-cd-setup --agent=devops-engineer
```

### 5. `audit-system`
**Purpose**: Get system audit and improvement suggestions
**Usage**: `/prompt-advisor audit-system [options]`
**Best for**: Code review, security audit, performance optimization

**Example**:
```bash
/prompt-advisor audit-system --priority=high
```

### 6. `agent-mode`
**Purpose**: Get agent mode specific suggestions
**Usage**: `/prompt-advisor agent-mode --agent=<mode> [options]`
**Best for**: Specialized tasks for specific agent modes

**Supported Agent Modes**:
- `architect-orchestrator` - Planning and coordination
- `frontend-engineer` - React/TypeScript development
- `backend-engineer` - API and database development
- `qa-engineer` - Testing and quality assurance
- `devops-engineer` - Infrastructure and deployment
- `security-specialist` - Security and compliance

**Example**:
```bash
/prompt-advisor agent-mode --agent=frontend-engineer --format=markdown
```

## Options

### `--context=<phase>`
Specify the context phase for suggestions
- **Values**: `setup`, `architecture`, `implementation`, `testing`, `deployment`
- **Default**: Auto-detect from current phase

### `--agent=<mode>`
Specify the agent mode for specialized suggestions
- **Values**: Any supported agent mode
- **Default**: All modes

### `--priority=<level>`
Filter suggestions by priority level
- **Values**: `high`, `medium`, `low`, `all`
- **Default**: `all`

### `--format=<type>`
Output format for results
- **Values**: `json`, `markdown`
- **Default**: `json`

### `--auto-execute`
Auto-execute high-priority tasks (Taskfile integration only)
- **Values**: `true`, `false`
- **Default**: `false`

## Integration Features

### 1. Conductor Framework Integration
- **Automatic Phase Detection**: Reads current phase from `.cline/context/current-phase.json`
- **State Synchronization**: Updates conductor framework state automatically
- **Progress Tracking**: Tracks completion and progress metrics

### 2. Taskfile Integration
- **Direct Task Execution**: Execute suggested tasks via Taskfile
- **Background Processing**: Run tasks in background with logging
- **Parallel Execution**: Execute multiple tasks simultaneously

### 3. Agent Mode Coordination
- **Intelligent Mode Selection**: Automatically select appropriate agent modes
- **Dependency Management**: Handle task dependencies between modes
- **Validation Integration**: Validate task completion against requirements

### 4. Context Awareness
- **Project State Analysis**: Analyze current project state and recent interactions
- **Roadmap Integration**: Align suggestions with project roadmap
- **System Health Monitoring**: Check system health and configuration

## Output Formats

### JSON Format (Default)
```json
{
  "timestamp": "2025-12-16T01:20:00.000Z",
  "currentPhase": "architecture",
  "projectState": {
    "currentPhase": "architecture",
    "phaseStartTime": "2025-12-16T00:00:00.000Z",
    "recentInteractions": [...],
    "systemHealth": "healthy"
  },
  "suggestions": [
    {
      "priority": "high",
      "agentMode": "architect-orchestrator",
      "category": "architecture",
      "prompt": "Design comprehensive database schema...",
      "estimatedTime": "45 minutes",
      "dependencies": ["backend-engineer"],
      "validation": "Schema normalization, performance benchmarks, security review"
    }
  ],
  "nextPhase": "implementation",
  "recommendedTasks": ["architecture", "database-design", "api-specification"]
}
```

### Markdown Format
```markdown
# /prompt-advisor Results

**Generated**: 2025-12-16T01:20:00.000Z
**Current Phase**: architecture

## Suggestions (3)

### 1. Design comprehensive database schema...
- **Priority**: high
- **Agent Mode**: architect-orchestrator
- **Category**: architecture
- **Estimated Time**: 45 minutes
- **Dependencies**: backend-engineer

### 2. Create API specification...
- **Priority**: high
- **Agent Mode**: architect-orchestrator
- **Category**: architecture
- **Estimated Time**: 30 minutes
- **Dependencies**: backend-engineer, devops-engineer

## Next Phase
- **Phase**: implementation

## Recommended Tasks
- architecture
- database-design
- api-specification
```

## Usage Examples

### Example 1: Daily Development Workflow
```bash
# Start your day by getting next steps
/prompt-advisor next-steps --priority=high

# Get specific suggestions for your current phase
/prompt-advisor architecture-phase --agent=architect-orchestrator

# Execute high-priority tasks automatically
task next-steps AUTO_EXECUTE=true PRIORITY=high
```

### Example 2: Phase Transition
```bash
# Complete current phase and get next phase suggestions
task phase.complete PHASE=architecture RESULTS='{"status":"completed"}'

# Get implementation phase suggestions
/prompt-advisor implementation-phase --priority=high

# Sync conductor framework
task conductor.sync
```

### Example 3: Agent Mode Specialization
```bash
# Get frontend-specific suggestions
/prompt-advisor agent-mode --agent=frontend-engineer --format=markdown

# Get backend implementation tasks
/prompt-advisor implementation-phase --agent=backend-engineer

# Get CI/CD automation suggestions
/prompt-advisor ci-cd-setup --agent=devops-engineer
```

### Example 4: System Audit and Improvement
```bash
# Conduct comprehensive system audit
/prompt-advisor audit-system --priority=high

# Get security-specific suggestions
/prompt-advisor audit-system --agent=security-specialist

# Review code quality and performance
/prompt-advisor agent-mode --agent=qa-engineer --priority=medium
```

## Troubleshooting

### Common Issues

1. **"Current phase unknown"**
   - **Solution**: Run `task phase.start PHASE=setup` to initialize the project
   - **Check**: Verify `.cline/context/current-phase.json` exists

2. **"System health: critical"**
   - **Solution**: Check that required files exist:
     - `.cline/context/current-phase.json`
     - `plans/plan.md`
     - `.cline/workflows/agent-orchestration.json`

3. **"No suggestions found"**
   - **Solution**: Ensure you're using the correct phase and agent mode
   - **Check**: Verify the phase exists in the roadmap

4. **Taskfile integration issues**
   - **Solution**: Ensure Taskfile is installed and configured
   - **Check**: Run `task --version` to verify installation

### Debug Mode
```bash
# Enable debug output
DEBUG=1 /prompt-advisor next-steps

# Check system health
/prompt-advisor next-steps --format=json | jq '.projectState.systemHealth'
```

## Best Practices

### 1. Regular Usage
- **Daily**: Check next steps at the start of each development day
- **Phase Transitions**: Use phase-specific commands when transitioning between phases
- **Weekly**: Run system audit to identify improvement opportunities

### 2. Agent Mode Coordination
- **Start with Architect**: Use architect-orchestrator for planning and coordination
- **Specialize appropriately**: Use specialized agent modes for specific tasks
- **Coordinate dependencies**: Ensure proper task ordering and dependencies

### 3. Integration with Workflow
- **Taskfile integration**: Use Taskfile for automated task execution
- **Conductor framework**: Keep conductor framework synchronized
- **Documentation**: Update documentation based on suggestions

### 4. Quality Assurance
- **Validation**: Always validate task completion against requirements
- **Testing**: Include testing in all implementation suggestions
- **Security**: Consider security implications in all suggestions

## Advanced Features

### 1. Custom Agent Modes
You can extend the system with custom agent modes by modifying the `modeSuggestions` object in the prompt-advisor script.

### 2. Custom Phases
Add new phases to the roadmap by updating the phase-specific suggestion functions.

### 3. Integration with External Tools
The system can be extended to integrate with external tools and services via the Taskfile integration.

### 4. Custom Output Formats
Add new output formats by extending the `outputResult` method in the prompt-advisor script.

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review the integration examples
3. Test with the provided test script: `node .cline/scripts/test-prompt-advisor.js`
4. Consult the Taskfile documentation for integration issues

## Version Information

- **Version**: 1.0.0
- **Last Updated**: December 2025
- **Compatibility**: Node.js 18+, Taskfile 3.0+, Cline CLI