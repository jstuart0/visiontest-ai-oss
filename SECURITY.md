# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | Yes |
| < 2.0   | No |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

**DO NOT** open a public GitHub issue for security vulnerabilities.

### How to Report

1. Email **security@visiontest.dev** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

2. You will receive an acknowledgment within **48 hours**.

3. We will work with you to understand and address the issue before any public disclosure.

### What to Expect

- **48 hours**: Initial acknowledgment
- **7 days**: Assessment and plan communicated
- **30 days**: Fix developed and tested
- **90 days**: Maximum time before public disclosure (coordinated)

### Scope

The following are in scope:
- VisionTest.ai application code (api, web, worker)
- Authentication and authorization
- Data exposure or injection vulnerabilities
- Cryptographic issues

The following are out of scope:
- Vulnerabilities in third-party dependencies (report upstream)
- Social engineering attacks
- Denial of service attacks
- Issues in example/test configurations

### Recognition

We appreciate responsible disclosure and will:
- Credit reporters in release notes (unless anonymity is requested)
- Not pursue legal action against good-faith security researchers

## Security Best Practices for Deployers

- Always set `ENCRYPTION_KEY` for secret-at-rest encryption
- Use strong, unique values for `JWT_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars)
- Never set `SCREENSHOT_PUBLIC_ACCESS=true` in production
- Enable NetworkPolicies in your Kubernetes cluster
- Keep all container images updated
- Review and rotate credentials regularly
