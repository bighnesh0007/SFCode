# Contributing to SFCode

Thanks for helping build a better place to practise Salesforce development.
Most contributions are **content** (new problems and certification questions),
and you don't need any accounts to write or test those locally.

- [Run it locally](#run-it-locally) · [Checks](#checks) · [Add a problem](docs/adding-a-problem.md) ·
  [Add a certification question](docs/adding-a-question.md) · [Pull requests](#pull-requests)

## Run it locally

You need **Node 22** (see `.nvmrc`) and, for some features, Docker.

```bash
npx npm@11 install     # npm 10.9 crashes on this tree; npm 11 works
npm run dev            # site http://localhost:8100, API http://localhost:4100
```

That's enough to browse every problem and use Certification Prep. SFCode runs in
**local mode** when it has no keys: everyone is signed out, and anything that
needs an account says so instead of failing.

| To also get… | You need | Set in |
|---|---|---|
| Saved progress and submissions | Postgres: `npm run db:up` then `npm run db:migrate -w sfcode-server` | `server/.env`: `DATABASE_URL` |
| Sign-in | A free [Clerk](https://clerk.com) development app | `client/.env.local` and `server/.env` |
| Running or grading Apex | A Salesforce External Client App + a Developer Edition org | `server/.env` (see README) |

Start from the examples: `cp server/.env.example server/.env` and
`cp client/.env.example client/.env.local`. **Never commit a `.env` file**; they're
gitignored for a reason.

## Checks

CI runs exactly these on every pull request. Run them before pushing:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm test` skips the Postgres repository tests unless you point them at a
throwaway database whose name ends in `_test`:

```bash
docker compose exec postgres psql -U sfcode -c 'CREATE DATABASE sfcode_test'
TEST_DATABASE_URL=postgres://sfcode:sfcode@127.0.0.1:5433/sfcode_test npm test
```

## Project layout

```
client/                 Next.js app (App Router, Tailwind, shadcn/base-ui, Monaco)
server/                 Express API (zod validation, Drizzle + Postgres, pino)
  problems/             Challenge, SOQL and debugging problems  → docs/adding-a-problem.md
  certification/        Certification question banks            → docs/adding-a-question.md
  src/services/         Business logic (no Express imports)
  src/routes/           HTTP wiring
```

## Conventions

- **TypeScript strict** everywhere. Validate input at the boundary with zod; never
  spread a request body into a database write.
- **Config is read in one place**, `server/src/config/`. Lint stops `process.env`
  anywhere else.
- **Comment why, not what.**
- **Tests for behaviour, not lines.** If a test guards something important, break
  the code once and watch the test fail.
- **Expected outputs come from running the real thing**, never typed in by hand. For
  problems that means `npm run verify:problems` (see the problem guide).

## Pull requests

- Branch from `main`. One logical change per PR.
- Title in [Conventional Commits](https://www.conventionalcommits.org/) style:
  `feat: …`, `fix: …`, `docs: …`, `content: add SOQL problem on semi-joins`.
- Fill in the PR template, including **how you verified it**. "It should work"
  isn't verification; paste what you ran.
- Keep PRs reviewable. Large redesigns or new architecture: open an issue first so
  we can agree the approach before you build it.

By contributing you agree your work is released under the [MIT License](LICENSE)
and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
