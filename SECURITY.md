# Security Policy

## Reporting

Report suspected security issues to the maintainers privately before opening a public issue.

- Preferred contact: `security@linketconnect.com`
- Fallback: open a private support request and label it `security`

Include:

- Affected URL, API route, or file path
- Reproduction steps or proof of concept
- Impact assessment
- Any logs, screenshots, or request samples that help triage

## Response Targets

- Initial triage: within 3 business days
- Status update after triage: within 5 business days
- Fix timeline: based on severity and exploitability

## Severity Triage

- Critical: account takeover, remote code execution, sensitive data exposure, authz bypass
- High: stored XSS, CSRF on privileged actions, injection, billing or identity integrity issues
- Medium: reflected XSS, SSRF without privilege crossing, information disclosure with limited scope
- Low: hardening gaps without a demonstrated exploit path

## Disclosure

- Do not publicly disclose details until the issue is confirmed and a fix or mitigation is available.
- Coordinated disclosure is preferred.
