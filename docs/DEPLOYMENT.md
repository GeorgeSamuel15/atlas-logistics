# Running and deploying Atlas

## Local built application

Run `npm ci`, `npm run setup`, `npm run build`, then `npm start` from the repository root. The built server serves the API and frontend on port 4000. SQLite resides at `apps/api/data/atlas.sqlite` unless `DB_PATH` is set. Demo setup must remain separate from ordinary startup.

## Clean database bootstrap

For an empty non-demo database, set `DB_PATH` to a new path, set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (at least 12 characters), and optionally `BOOTSTRAP_NAME`, then run `npm run bootstrap`. This creates only one administrator and refuses to overwrite a populated database. Remove the bootstrap variables afterward. Log in as administrator to add team members, vehicles and hubs. Customers can register themselves.

Example PowerShell:

```powershell
$env:DB_PATH="C:\atlas-data\live.sqlite"
$env:BOOTSTRAP_EMAIL="admin@your-company.example"
$env:BOOTSTRAP_PASSWORD="Choose-your-own-long-password"
npm run bootstrap
Remove-Item Env:BOOTSTRAP_PASSWORD
```

## Docker

The included Compose configuration is for a local demonstration and exposes the app on localhost:4000. It uses a named volume for database persistence. It does not automatically seed accounts.

```sh
docker compose build
docker compose run --rm app npm run setup
docker compose up
```

Do not seed a public production instance. Use the clean bootstrap command with environment variables instead.

## Public deployment requirements

Use one application instance backed by persistent disk. Set `HOST=0.0.0.0`, `PORT`, an absolute persistent `DB_PATH`, `NODE_ENV=production`, and `APP_ORIGINS=https://your-exact-domain.example`. Put the app behind HTTPS. Secure cookies will not work on plain HTTP in production. Keep frontend and API under the same origin. A static-only host cannot run the API or persistent SQLite database.

The included build/runtime image retains development dependencies to support the explicit seed/bootstrap commands. For a hardened production image, split administrative tools into a separate image and prune development dependencies after compilation.

Document and test backups before storing real records. Stop the application and copy the database (including any remaining WAL state), or use SQLite's online backup interface; copying an actively written main database alone is not a reliable backup. Restrict filesystem access. Do not log credentials or session tokens. Review privacy/retention requirements for addresses and submitted driver locations.

This codebase has not been load-tested, penetration-tested, externally audited or deployed publicly during delivery. Use the documented PostgreSQL and background-job migration boundary before scaling beyond its single-instance design. Payment gateways, SMTP/SMS providers and commercial mapping/routing are separate integrations, not environment switches that turn on existing implementations.

## Continuous integration

The GitHub Actions workflow installs the lockfile, type-checks/builds the app and runs API tests on Node 24. Browser tests are included separately because they need a Chromium installation. Check `VALIDATION.md` for the checks actually executed in the build environment.
