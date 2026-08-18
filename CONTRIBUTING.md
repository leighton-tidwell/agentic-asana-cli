# Contributing

## Local setup

Use Node.js 20 or newer and a clean checkout:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:api-coverage
npm run test:packaging
npm run format:check
```

Do not add credentials to fixtures, snapshots, commands, issue reports, or logs. Use synthetic values in tests. Live tests must receive credentials through environment variables and clean up every created object in an unconditional teardown.

## Pull requests

1. Branch from `main` and keep each PR focused.
2. Add or update tests for behavior changes.
3. If the Asana OpenAPI snapshot changes, include regenerated outputs and the operation coverage count.
4. Run the complete local check list above.
5. Explain user-visible behavior, security implications, and rollback in the PR body.

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`). By contributing, you agree that your contribution is licensed under MIT.
