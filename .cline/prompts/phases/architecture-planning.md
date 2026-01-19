# Architecture & Planning Prompts

## System Architecture Design
```
@context: business-requirements, technical-constraints, scalability-needs
@agent: architect-orchestrator
@phase: architecture

Design the system architecture for [PROJECT_NAME] based on the following specifications:

**Business Requirements:**
- User Base: [EXPECTED_USERS]
- Performance: [RESPONSE_TIME_REQUIREMENTS]
- Availability: [UPTIME_REQUIREMENTS]
- Data Volume: [DATA_VOLUME_EXPECTATIONS]

**Technical Constraints:**
- Budget: [BUDGET_CONSTRAINTS]
- Timeline: [DEVELOPMENT_TIMELINE]
- Team Expertise: [SKILL_LEVELS]
- Integration Points: [EXISTING_SYSTEMS]

**Architecture Components:**
1. Frontend Architecture
2. Backend Services
3. Data Storage Strategy
4. Security Implementation
5. Monitoring and Observability

**Output Format:**
- Architecture diagram (PlantUML format)
- Component specification document
- Technology stack recommendation
- Migration strategy (if applicable)
- Risk assessment and mitigation plan

**Success Criteria:**
- Scalable to [SCALING_FACTOR] times current requirements
- Meets all performance and availability targets
- Maintains security and compliance standards
- Provides clear development roadmap
```

## Technical Planning & Roadmap
```
@context: architecture-design, business-priorities, resource-availability
@agent: architect-orchestrator
@phase: planning

Create a detailed technical implementation roadmap for [PROJECT_NAME]:

**Phase Breakdown:**
- Phase 1: [CORE_FOUNDATION]
- Phase 2: [ESSENTIAL_FEATURES]
- Phase 3: [ADVANCED_CAPABILITIES]
- Phase 4: [OPTIMIZATION_AND_SCALE]

**Resource Allocation:**
- Team Structure: [TEAM_COMPOSITION]
- Timeline: [PHASE_TIMELINES]
- Budget Allocation: [BUDGET_DISTRIBUTION]
- Risk Mitigation: [RISK_STRATEGIES]

**Milestones and Deliverables:**
1. [MILESTONE_1]: [DESCRIPTION]
2. [MILESTONE_2]: [DESCRIPTION]
3. [MILESTONE_3]: [DESCRIPTION]

**Output Format:**
- Gantt chart or timeline visualization
- Resource allocation matrix
- Risk register with mitigation strategies
- Quality gates and approval criteria
- Dependencies and critical path analysis