# VisionTest MCP Server Spec And Implementation Plan

## Goal

Provide an MCP server that lets agents:

- create tests from natural-language use cases
- run tests and suites
- launch exploratory click-around scans
- inspect failures, comparisons, and artifacts
- promote exploratory findings into durable tests

The MCP server should wrap VisionTest's existing API and business logic. It should not talk directly to Playwright or reimplement VisionTest logic.

## Architecture Rule

Keep this boundary strict:

- **VisionTest API owns business logic**
- **VisionTest worker owns Playwright execution**
- **MCP owns agent-friendly tool/resource shapes**

The MCP server should be thin.

## Recommended Package Layout

Create a new workspace:

- `apps/mcp/`

Recommended files:

- `apps/mcp/src/index.ts`
- `apps/mcp/src/server.ts`
- `apps/mcp/src/auth.ts`
- `apps/mcp/src/client.ts`
- `apps/mcp/src/types.ts`
- `apps/mcp/src/tools/projects.ts`
- `apps/mcp/src/tools/tests.ts`
- `apps/mcp/src/tools/executions.ts`
- `apps/mcp/src/tools/comparisons.ts`
- `apps/mcp/src/tools/scans.ts`
- `apps/mcp/src/resources.ts`

## Proposed v1 MCP Tools

### Project and Test Discovery

#### `list_projects`

Input:

```json
{}
```

Output:

```json
{
  "projects": [
    { "id": "proj_123", "name": "Web App", "orgId": "org_123" }
  ]
}
```

#### `list_tests`

Input:

```json
{
  "project_id": "proj_123",
  "status": "ACTIVE",
  "tags": ["checkout"],
  "search": "login",
  "page": 1,
  "limit": 50
}
```

Output:

```json
{
  "tests": [
    {
      "id": "test_123",
      "name": "Login happy path",
      "status": "ACTIVE",
      "lastStatus": "PASSED",
      "lastRun": "2026-04-23T01:00:00Z"
    }
  ]
}
```

#### `get_test`

Input:

```json
{
  "test_id": "test_123"
}
```

Output:

```json
{
  "test": {
    "id": "test_123",
    "name": "Login happy path",
    "steps": [],
    "goal": "Dashboard is visible",
    "storySource": "Log in as admin..."
  }
}
```

### Story And Use-Case Creation

#### `parse_story_to_steps`

Input:

```json
{
  "project_id": "proj_123",
  "story": "Log in as admin@example.com. Click Orders.",
  "goal": "Orders page is visible",
  "start_url": "https://app.example.com"
}
```

Output:

```json
{
  "steps": [],
  "diagnostics": [],
  "goal_checks": [],
  "unresolved_goal_clauses": []
}
```

#### `create_test_from_story`

Input:

```json
{
  "project_id": "proj_123",
  "name": "Orders navigation story",
  "story": "Log in as admin@example.com. Click Orders.",
  "goal": "Orders page is visible",
  "start_url": "https://app.example.com",
  "environment": "staging",
  "credential_ref": "admin"
}
```

Output:

```json
{
  "saved": true,
  "test_id": "test_123",
  "steps": [],
  "goal_checks": [],
  "unresolved_goal_clauses": []
}
```

#### `update_test`

Input:

```json
{
  "test_id": "test_123",
  "patch": {
    "goal": "Orders table is visible",
    "tags": ["smoke", "orders"]
  }
}
```

Output:

```json
{
  "test": {}
}
```

### Execution

#### `run_test`

Input:

```json
{
  "project_id": "proj_123",
  "test_id": "test_123",
  "browser": "chromium",
  "headless": true
}
```

Output:

```json
{
  "execution_id": "exec_123",
  "status": "QUEUED"
}
```

#### `run_suite`

Input:

```json
{
  "project_id": "proj_123",
  "suite_id": "suite_123"
}
```

Output:

```json
{
  "execution_id": "exec_456",
  "status": "QUEUED"
}
```

#### `get_execution`

Input:

```json
{
  "execution_id": "exec_123"
}
```

Output:

```json
{
  "execution": {
    "id": "exec_123",
    "status": "RUNNING",
    "duration": null
  }
}
```

#### `wait_for_execution`

Input:

```json
{
  "execution_id": "exec_123",
  "timeout_seconds": 120
}
```

Output:

```json
{
  "execution": {
    "id": "exec_123",
    "status": "FAILED"
  },
  "terminal": true
}
```

#### `get_failure_summary`

Input:

```json
{
  "execution_id": "exec_123"
}
```

Output:

```json
{
  "status": "FAILED",
  "failed_steps": [],
  "failed_comparisons": [],
  "goal_failure": null,
  "artifact_refs": []
}
```

### Exploratory Testing

#### `start_smoke_explore`

Input:

```json
{
  "project_id": "proj_123",
  "start_url": "https://app.example.com"
}
```

Output:

```json
{
  "execution_id": "exec_789",
  "status": "QUEUED",
  "tier": "smoke"
}
```

#### `start_project_scan`

Input:

```json
{
  "project_id": "proj_123",
  "start_url": "https://app.example.com",
  "max_pages": 20,
  "max_clicks_per_page": 10,
  "safety": {
    "mode": "read-only"
  }
}
```

Output:

```json
{
  "execution_id": "exec_999",
  "status": "QUEUED"
}
```

#### `get_scan_tree`

Input:

```json
{
  "execution_id": "exec_999"
}
```

Output:

```json
{
  "summary": {},
  "nodes": []
}
```

#### `promote_scan_finding_to_test`

Input:

```json
{
  "project_id": "proj_123",
  "execution_id": "exec_999",
  "node_id": "node_123",
  "name": "Broken export button"
}
```

Output:

```json
{
  "test_id": "test_456",
  "generated_steps": []
}
```

### Failure And Diff Inspection

#### `list_failed_comparisons`

Input:

```json
{
  "project_id": "proj_123"
}
```

Output:

```json
{
  "comparisons": []
}
```

#### `get_comparison`

Input:

```json
{
  "comparison_id": "cmp_123"
}
```

Output:

```json
{
  "comparison": {}
}
```

## Proposed v1 Resources

- `visiontest://project/{id}/summary`
- `visiontest://test/{id}`
- `visiontest://execution/{id}/summary`
- `visiontest://execution/{id}/timeline`
- `visiontest://execution/{id}/artifacts`
- `visiontest://comparison/{id}`
- `visiontest://comparison/{id}/diff`
- `visiontest://scan/{id}/summary`
- `visiontest://scan/{id}/nodes`

These should be added after the core tools are working.

## Existing Repo Surfaces To Wrap

Primary existing routes:

- [apps/api/src/routes/projects.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/projects.ts)
- [apps/api/src/routes/tests.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/tests.ts)
- [apps/api/src/routes/executions.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/executions.ts)
- [apps/api/src/routes/comparisons.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/comparisons.ts)
- [apps/api/src/routes/scans.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/scans.ts)
- [apps/api/src/routes/templates.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/templates.ts)
- [apps/api/src/routes/features.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/routes/features.ts)

Relevant services:

- [apps/api/src/services/testParser.service.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/services/testParser.service.ts)
- [apps/api/src/services/goalCompiler.service.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/services/goalCompiler.service.ts)
- [apps/api/src/services/bugReportImport.service.ts](/Users/jaystuart/dev/visiontest-ai-oss/apps/api/src/services/bugReportImport.service.ts)

## API Gaps To Fill First

To keep the MCP server thin, add or confirm these API surfaces exist:

- `GET /api/v1/tests/:id`
- `PATCH /api/v1/tests/:id`
- `POST /api/v1/tests/story-preview`
- `POST /api/v1/tests/story`
- `GET /api/v1/executions/:id`
- `GET /api/v1/executions/:id/failure-summary`
- `POST /api/v1/scans/:executionId/nodes/:nodeId/promote`

If a route does not exist, create it in the API rather than putting business logic into `apps/mcp`.

## Build Order

### Phase 1: Thin Wrapper

Implement these first:

- `list_projects`
- `list_tests`
- `get_test`
- `run_test`
- `get_execution`
- `wait_for_execution`
- `list_failed_comparisons`
- `get_comparison`
- `start_smoke_explore`
- `start_project_scan`
- `get_scan_tree`

### Phase 2: Use-Case Creation

Add:

- `parse_story_to_steps`
- `create_test_from_story`
- `update_test`

### Phase 3: Exploratory Promotion

Add:

- `promote_scan_finding_to_test`

### Phase 4: Resources

Add the execution/comparison/scan resources listed above.

## Auth Model

Use existing VisionTest API auth rather than direct database access.

Recommended MCP env vars:

- `VISIONTEST_API_URL`
- `VISIONTEST_API_TOKEN`

The MCP server should authenticate to VisionTest just like any other client.

## Testing Plan

Add tests under `apps/mcp/src/__tests__/`.

Minimum end-to-end flows:

1. parse story to steps
2. create test from story
3. run test
4. wait for execution
5. fetch failure summary
6. start smoke explore
7. fetch scan tree
8. promote scan finding to test

## First Week Target

If this is delegated to agents, the best first-week outcome is:

1. scaffold `apps/mcp`
2. implement typed API client
3. ship read-only tools
4. ship `run_test` and `wait_for_execution`
5. ship `start_smoke_explore` and `get_scan_tree`
6. ship `create_test_from_story`

That is enough to make VisionTest immediately useful to agents without overbuilding the first release.
