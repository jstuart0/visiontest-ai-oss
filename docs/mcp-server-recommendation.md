# VisionTest MCP Server Recommendation

## Conclusion

VisionTest should have an MCP server.

It is worth doing because MCP gives coding agents and chat clients a stable, agent-friendly way to:

- create tests from natural-language use cases
- run tests and suites
- launch exploratory scans that click around the app safely
- inspect failures, comparisons, screenshots, and scan trees
- promote exploratory findings into durable regression tests

The correct boundary is:

- **VisionTest MCP exposes QA workflows**
- **Playwright remains an internal execution engine**

VisionTest should **not** expose general-purpose browser primitives like `navigate`, `click`, or `type` outside the context of a test or scan. Playwright already covers that category well enough elsewhere. VisionTest's value is the persistent QA system around tests, executions, baselines, approvals, scans, and artifacts.

## Product Boundary

The MCP server should be organized around VisionTest nouns:

- `project`
- `test`
- `suite`
- `execution`
- `comparison`
- `baseline`
- `scan`
- `feature`
- `template`

And around these user intents:

- author a test from a use case
- run a test or suite
- click around the app safely
- inspect what failed
- convert a discovered issue into a permanent test

The MCP server should **not** be a second browser automation product.

## What the MCP Server Should Provide

### Authoring

- Story/use-case driven test creation
- Story parsing preview before save
- Bug-report-to-test conversion
- Template discovery and feature grouping

### Execution

- Run a test
- Run a suite
- Wait for execution completion
- Cancel execution

### Exploratory Testing

- Smoke Explore for lightweight, safe click-around behavior
- Full project scan for authenticated users
- Scan tree inspection
- Promotion of scan findings into durable tests

### Failure Inspection

- Execution summaries
- Failed step summaries
- Visual comparison inspection
- Artifact access for screenshots, diffs, logs, and videos

### Review Workflows

Potentially later:

- approve comparison
- reject comparison
- update baseline

These should not be part of the first MCP cut unless confirmation semantics are very clear.

## Recommended MCP Surfaces

### Tools first

The best first version is tool-heavy. Tools are the most portable and useful MCP surface across clients.

Recommended first-class tools:

- `list_projects`
- `list_tests`
- `get_test`
- `parse_story_to_steps`
- `create_test_from_story`
- `update_test`
- `run_test`
- `run_suite`
- `get_execution`
- `wait_for_execution`
- `get_failure_summary`
- `list_failed_comparisons`
- `get_comparison`
- `start_smoke_explore`
- `start_project_scan`
- `get_scan_tree`
- `promote_scan_finding_to_test`

### Resources second

Resources are the right place for heavier, persistent context:

- `visiontest://project/{id}/summary`
- `visiontest://test/{id}`
- `visiontest://execution/{id}/summary`
- `visiontest://execution/{id}/timeline`
- `visiontest://execution/{id}/artifacts`
- `visiontest://comparison/{id}`
- `visiontest://comparison/{id}/diff`
- `visiontest://scan/{id}/summary`
- `visiontest://scan/{id}/nodes`

### Prompts optional

Prompts can be useful later, but they are not required for the first release. Reasonable future prompts:

- `triage_visual_failure`
- `author_test_from_bug_report`
- `review_scan_findings`
- `decide_baseline_update`

## Why This Is Worth Doing

An MCP server would let agents use VisionTest as persistent QA infrastructure rather than as a UI-only tool.

That means an agent can:

- turn a user story into an executable test
- run the test after a change
- inspect the visual diff and execution artifacts
- safely scan an app to find broken interactions
- convert an exploratory finding into a regression test

This is a meaningful product extension because it aligns directly with how users already think about VisionTest.

## Why Not Build a Full Browser-Control Surface

That would be the wrong boundary for this product.

If VisionTest exposed arbitrary `click`, `navigate`, `hover`, and `type` primitives over MCP, it would:

- duplicate general-purpose browser automation surfaces
- blur the line between test authoring and ad hoc browser control
- create unnecessary API surface and support burden
- pull attention away from VisionTest's durable QA workflows

Playwright should stay internal to test execution. The MCP surface should expose the QA concepts above Playwright, not Playwright itself.

## Recommended Scope

### Definitely worth doing now

- a TypeScript MCP server
- tool-first design
- thin wrapper over the existing VisionTest API
- read-only inspection plus safe mutations
- story-driven authoring and exploratory scan workflows

### Worth doing later

- richer resources for screenshots and diff context
- prompts for reusable triage flows
- approval/baseline mutation tools with explicit confirmation
- MCP apps or UI extensions for visual diff review

### Not recommended for v1

- general-purpose browser control
- full parity with every VisionTest REST endpoint
- credential/admin management over MCP
- complex UI/app extensions before tool usage proves the need

## Bottom Line

VisionTest should build an MCP server, but it should build the **right** MCP server.

The right product is:

- a QA orchestration and artifact server
- centered on tests, executions, comparisons, and scans
- capable of both use-case creation and exploratory click-around testing
- explicitly not a generic browser-driving server

That scope is worth doing now.
