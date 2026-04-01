# Changelog

All notable changes to VisionTest AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-31

### Added
- AI-powered visual diff pipeline with 4-stage cascade (SSIM, LPIPS, DINOv2, VLM)
- Embeddings sidecar service for perceptual and semantic similarity analysis
- Autonomous bug fixing pipeline (investigate, classify, patch, verify, deliver)
- Natural language test creation with LLM fallback for complex instructions
- Storybook integration with automatic component discovery and polling sync
- In-app setup wizards for Storybook and AI Diff configuration
- API testing capability with assertions and environment management
- Smart test selection with impact mapping and confidence scoring
- Self-healing selectors with 4-strategy cascade (cache, DOM, heuristic, LLM)
- Flaky test detection with automatic quarantine
- Multi-provider AI support (Anthropic, OpenAI, OpenRouter, Gemini, Local/Ollama)
- Approval workflows with review chains
- Scheduled test execution
- Webhook notifications
- Device profile management for cross-browser and cross-viewport testing
- Screenshot masking and comparison tools
- Video recording of test executions
- Live browser streaming via CDP screencast
- Helm chart for Kubernetes deployment
- One-command installation via install script
- Comprehensive security hardening

### Security
- JWT algorithm pinned to HS256 with minimum secret length enforcement
- Refresh tokens rejected by access-only endpoints
- SSRF protection on all server-side fetch paths (fail-closed, IPv4+IPv6)
- Redis-backed rate limiting with per-user keying
- AES-256-GCM encryption for stored API keys and repository tokens
- Non-root containers (except worker for Playwright compatibility)
- Kubernetes NetworkPolicies for pod-to-pod isolation
- Sensitive field redaction in error logs
- WebSocket authentication with per-event org membership checks

## [1.0.0] - 2025-12-01

### Added
- Initial release with core visual regression testing
- Playwright-based browser automation
- Screenshot comparison with pixelmatch
- Basic project and test management
- JWT authentication
