# SFCode

A LeetCode-style practice platform for Salesforce developers. Same look and
stack as DWCode: a Next.js client and an Express API in one npm workspace.

**Status: Phase 0.** Live: the site shell, connecting a Salesforce org, and the
**Apex Playground** (run anonymous Apex in your org and see the debug log).
Everything else in the navbar is a placeholder page.

## Layout

```
client/   Next.js 16 (App Router), Tailwind 4, shadcn/base-ui, Clerk, Monaco  :8100
server/   Express 5, zod, Drizzle + Postgres, pino                            :4100
```

The browser only talks to `:8100`; Next proxies `/backend/*` to the API.
The product catalogue (nav, home grid, footer, placeholders) is one list:
`client/lib/features.ts`.

## Run it locally

```bash
npx npm@11 install          # npm 10.9 crashes resolving this tree (arborist edgesOut bug)
docker compose up -d        # Postgres on 127.0.0.1:5433
cp server/.env.example server/.env    # then fill in, see below
cp client/.env.example client/.env.local
npm run db:migrate -w sfcode-server
npm run dev
```

### Secrets

Generate `TOKEN_ENCRYPTION_KEY` and `OAUTH_STATE_SECRET` with `openssl rand -hex 32`.
Clerk keys go in both env files (same Clerk app).

### Salesforce External Client App (one-time)

In any org you administer (a Developer Edition is fine): **Setup → External
Client App Manager → New External Client App**.

- Enable OAuth. Callback URL: `http://localhost:8100/backend/api/v1/salesforce/oauth/callback`
  and `https://sf.bighnesh.space/backend/api/v1/salesforce/oauth/callback` (it is `APP_URL` + that path).
- Scopes: **Manage user data via APIs (`api`)** and **Perform requests at any
  time (`refresh_token`, `offline_access`)**.
- Require PKCE: on. Require secret for Web Server Flow: on.
- Distribution: make it available to **other orgs** (so learners can connect
  their own orgs), then copy the consumer key/secret into `SF_CLIENT_ID` /
  `SF_CLIENT_SECRET`.

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
# Postgres repository tests (need a database whose name ends in _test):
TEST_DATABASE_URL=postgres://sfcode:sfcode@127.0.0.1:5433/sfcode_test npm test
```

## How the org connection works

OAuth 2.0 web-server flow with PKCE. The PKCE verifier is kept server-side
(`oauth_pending`, single-use, 10-minute expiry); `state` is HMAC-signed and
carries the user and return path. Access and refresh tokens are stored
AES-256-GCM encrypted and are never sent to the browser. Login and instance
hosts are restricted to Salesforce domains, and outbound requests refuse
redirects, so tokens can only go to Salesforce. Anonymous Apex runs through
the Apex SOAP API so the debug log comes back in the same call; an expired
session is refreshed once, and a revoked refresh token deletes the connection.
