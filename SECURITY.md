# Security Policy

SFCode stores Salesforce OAuth tokens for its users and runs user-submitted code
in their orgs, so we take security reports seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through
[GitHub Security Advisories](https://github.com/bighnesh0007/SFCode/security/advisories/new).
Include the steps to reproduce, the impact, and the affected commit or URL.

You'll get an acknowledgement within a few days. Please give us reasonable time to
fix it before disclosing publicly.

## Scope

In scope: this repository and the hosted site at https://sf.bighnesh.space,
especially:
- the Salesforce OAuth flow and token storage (`server/src/services/salesforce/`)
- grading and anything that builds code or queries from user input
  (`server/src/services/challenges/`)
- authorisation on API routes

Out of scope: Salesforce or Clerk themselves, denial of service by volume, and
findings that need a compromised user device.
