# Setup & Configuration Prompts

## Environment Setup
```
@context: project-requirements, tech-stack, deployment-target
@agent: architect-orchestrator
@phase: setup

Create a comprehensive development environment setup guide for [PROJECT_NAME] based on the following requirements:

**Project Context:**
- Tech Stack: [SPECIFIC_STACK]
- Deployment Target: [TARGET_ENVIRONMENT]
- Team Size: [TEAM_SIZE]
- Timeline: [PROJECT_TIMELINE]

**Requirements:**
1. Development environment configuration
2. Toolchain setup and optimization
3. CI/CD pipeline configuration
4. Code quality and linting rules
5. Testing framework setup

**Output Format:**
- JSON with setup steps and validation criteria
- Markdown documentation for team reference
- Configuration files for automation

**Success Criteria:**
- All team members can set up environment in under 30 minutes
- Zero configuration conflicts between team members
- Automated validation of setup completion
```

## Toolchain Optimization
```
@context: current-tools, project-requirements, performance-needs
@agent: architect-orchestrator
@phase: setup

Analyze the current development toolchain for [PROJECT_NAME] and provide optimization recommendations:

**Current State:**
- IDE/Editor: [CURRENT_IDE]
- Build Tools: [CURRENT_BUILD_TOOLS]
- Testing Framework: [CURRENT_TESTING]
- Version Control: [CURRENT_VCS]

**Optimization Goals:**
1. Reduce build times by [PERCENTAGE]%
2. Improve developer experience metrics
3. Enhance code quality automation
4. Streamline deployment process

**Output Format:**
- Comparative analysis table
- Implementation roadmap with phases
- ROI analysis for each optimization