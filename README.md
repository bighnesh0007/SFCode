# SFCode

[![CI](https://github.com/bighnesh0007/SFCode/actions/workflows/ci.yml/badge.svg)](https://github.com/bighnesh0007/SFCode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Open-source, LeetCode-style practice for Salesforce developers.** Write Apex,
SOQL and fixes for broken code, graded by hidden tests in *your own* connected
org. Prepare for Platform Developer I and II too.

Live at **https://sf.bighnesh.space**

| | |
|---|---|
| **Apex Challenge Arena** | Triggers, classes, Batch and async Apex, graded by a check-only deploy (nothing stays in your org) |
| **SOQL Practice** | One query per problem, checked row by row against the expected answer |
| **Debugging Arena** | Start from broken Apex: governor limits, recursion, nulls, off-by-ones |
| **Apex Playground** | Run anonymous Apex in your org and read the debug log |
| **Certification Prep** | Original PD I / PD II questions with explanations |

## Contributing

Contributions are welcome, especially **new problems and certification
questions**, which need no Salesforce or Clerk account to write and test.

- [CONTRIBUTING.md](CONTRIBUTING.md): run it locally in two commands, the checks, and conventions
- [Adding a problem](docs/adding-a-problem.md) · [Adding a question](docs/adding-a-question.md)
- [Code of Conduct](CODE_OF_CONDUCT.md) · [Security policy](SECURITY.md)

```bash
npx npm@11 install
npm run dev        # http://localhost:8100, runs in "local mode" with no keys
```

## How it's built

```
client/   Next.js 16 (App Router), Tailwind 4, shadcn/base-ui, Monaco      :8100
server/   Express 5, zod, Drizzle + Postgres, pino                         :4100
```

The browser only talks to the site; Next proxies `/backend/*` to the API.

**Grading.** A submission is deployed to the learner's org together with a
hidden test class as a **check-only** Metadata API deploy (`RunSpecifiedTests`).
Salesforce compiles everything, runs the tests and rolls back. The verdict comes
from Salesforce's own report. SOQL problems wrap the query, escaped, in a
generated class and compare its rows with a reference query's rows on records
the test creates.

**Org connection.** OAuth 2.0 web-server flow with PKCE. The verifier is kept
server-side (single-use, 10-minute expiry) and `state` is HMAC-signed. Tokens are
stored AES-256-GCM encrypted and never reach the browser. Login and instance
hosts are restricted to Salesforce domains, and outbound requests refuse
redirects.

## Self-hosting: Salesforce External Client App

Needed only to run or grade Apex. In an org you administer (a Developer Edition
is fine): **Setup → External Client App Manager → New External Client App**.

- Enable OAuth. Callback URL: `<APP_URL>/backend/api/v1/salesforce/oauth/callback`
  (e.g. `http://localhost:8100/backend/api/v1/salesforce/oauth/callback`).
- Scopes: **Manage user data via APIs (`api`)** and **Perform requests at any
  time (`refresh_token`, `offline_access`)**.
- Require PKCE: on. Require secret for Web Server Flow: on.
- Distribution: available to **other orgs**, so learners can connect their own.
- Put the consumer key and secret in `server/.env` as `SF_CLIENT_ID` and
  `SF_CLIENT_SECRET`. Generate `TOKEN_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET`
  with `openssl rand -hex 32`.

## License

[MIT](LICENSE)
