# Cline Prompt Library

Curated prompts for effective agent orchestration and development workflows.

## Prompt Categories

### Phase-Based Prompts
- **Setup & Configuration** - Initial project setup and environment configuration
- **Architecture & Planning** - System design and technical planning
- **Implementation** - Code development and feature implementation
- **Testing & Validation** - Quality assurance and testing strategies
- **Deployment & Operations** - Production deployment and monitoring

### Reusable Prompts
- **Code Review** - Automated code review and quality checks
- **Documentation** - Technical documentation generation
- **Refactoring** - Code optimization and restructuring
- **Debugging** - Issue diagnosis and resolution
- **Performance** - Optimization and performance tuning

## Usage Guidelines

### Context Management
- Use `@context` to reference project-specific information
- Include phase information for better agent understanding
- Reference previous interactions when building on existing work

### Agent Orchestration
- Use `@agent` to specify which agent mode to use
- Include validation criteria for result verification
- Specify output format requirements

### Best Practices
- Keep prompts focused and specific
- Include clear success criteria
- Use structured output formats (JSON, markdown tables)
- Reference project context and constraints