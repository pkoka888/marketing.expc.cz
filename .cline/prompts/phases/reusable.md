# Reusable Prompts

## Code Review
```
@context: code-changes, coding-standards, quality-metrics
@agent: frontend-engineer, backend-engineer
@phase: implementation

Perform comprehensive code review for the following changes:

**Code to Review:**
[INSERT_CODE_CHANGES]

**Review Criteria:**
1. **Code Quality**: Adherence to coding standards and best practices
2. **Security**: Potential vulnerabilities and security issues
3. **Performance**: Performance implications and optimization opportunities
4. **Maintainability**: Code readability and maintainability
5. **Testing**: Test coverage and quality

**Output Format:**
```json
{
  "reviewSummary": {
    "overallScore": "1-10",
    "criticalIssues": [],
    "suggestions": [],
    "approvals": []
  },
  "detailedFeedback": [
    {
      "file": "filename",
      "line": "line_number",
      "issue": "description",
      "severity": "critical/high/medium/low",
      "suggestion": "improvement"
    }
  ],
  "testCoverage": {
    "current": "percentage",
    "recommended": "percentage",
    "missingTests": []
  }
}
```

**Success Criteria:**
- All critical issues identified and documented
- Clear actionable suggestions provided
- Test coverage analysis completed
- Security vulnerabilities detected
```

## Documentation Generation
```
@context: codebase, api-specifications, user-stories
@agent: architect-orchestrator
@phase: documentation

Generate comprehensive documentation for [COMPONENT/FEATURE]:

**Input Sources:**
- Codebase: [SPECIFIC_FILES_OR_MODULES]
- API Specifications: [API_DEFINITIONS]
- User Stories: [USER_REQUIREMENTS]

**Documentation Types:**
1. **API Documentation**: Complete API reference with examples
2. **User Guide**: End-user documentation and tutorials
3. **Developer Guide**: Setup, configuration, and development guidelines
4. **Architecture Documentation**: System design and component relationships

**Output Format:**
- Markdown files organized by documentation type
- API documentation in OpenAPI/Swagger format
- Interactive examples and code snippets
- Diagrams for complex workflows

**Success Criteria:**
- All public APIs documented with examples
- User guide enables self-service setup
- Developer guide reduces onboarding time by 50%
- Architecture documentation supports future development
```

## Performance Optimization
```
@context: performance-metrics, bottlenecks, user-experience
@agent: backend-engineer, frontend-engineer
@phase: optimization

Analyze and optimize performance for [SYSTEM/FEATURE]:

**Current Performance Data:**
- Response Times: [CURRENT_METRICS]
- Throughput: [CURRENT_THROUGHPUT]
- Resource Usage: [CPU/MEMORY/NETWORK]
- User Experience: [UX_METRICS]

**Optimization Areas:**
1. **Database Performance**: Query optimization and indexing
2. **Application Performance**: Code optimization and caching
3. **Frontend Performance**: Bundle size and rendering optimization
4. **Infrastructure**: Server configuration and scaling

**Output Format:**
```json
{
  "performanceAnalysis": {
    "bottlenecks": [],
    "rootCauses": [],
    "impactAssessment": []
  },
  "optimizationPlan": [
    {
      "area": "description",
      "optimization": "specific_change",
      "expectedImpact": "quantified_improvement",
      "implementationEffort": "low/medium/high"
    }
  ],
  "monitoringStrategy": {
    "metrics": [],
    "alerts": [],
    "dashboards": []
  }
}
```

**Success Criteria:**
- Identify top 3 performance bottlenecks
- Provide quantified improvement estimates
- Create monitoring strategy for ongoing optimization
- Ensure optimizations don't compromise functionality