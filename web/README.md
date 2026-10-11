# Buy Buddy

Source-code export of the Buy Buddy prototype, including the latest hover animation,
updated handwritten note, and top-aligned principles section.

## Run locally

Requirements: Node.js 22 or newer and pnpm 10 (the project was last run with
Node.js 24.13.0 and pnpm 10.26.1).

Extract this ZIP, open a terminal inside the `buy-buddy` folder, then install dependencies:

```sh
pnpm install
```

Start the frontend on macOS or Linux:

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/buy-buddy run dev
```

On Windows PowerShell:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/buy-buddy run dev
```

Open http://localhost:5173 in your browser.

## Production build

On macOS or Linux:

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/buy-buddy run build
```

On PowerShell, set the same two environment variables shown above, then run:

```powershell
pnpm --filter @workspace/buy-buddy run build
```

The frontend output is written to `artifacts/buy-buddy/dist/public`.
Static hosting must send client-side routes back to `index.html`.

## Project contents

- `artifacts/buy-buddy/`: Buy Buddy frontend and image assets.
- `artifacts/api-server/`: Existing API-server scaffold.
- `artifacts/mockup-sandbox/`: Existing component-preview scaffold.
- `lib/`: Shared workspace packages.
- `docs/backend-integration.md`: Requirements for connecting the real backend.
- `pnpm-workspace.yaml` and `pnpm-lock.yaml`: Workspace and dependency configuration.

## Current functionality

This is a clearly labeled sample-data prototype for RTX 4090 searches.
Photo-verification outcomes are simulated. No payment is collected, no message is
sent to sellers, and no marketplace purchase or bid is submitted automatically.

The sample frontend does not require a database, API key, or authentication.
Live search and verification still require the user's backend API; consult
`docs/backend-integration.md` before connecting it.

## Export exclusions

Git history, installed dependencies, generated build outputs, temporary files,
local caches, credentials, internal agent notes, and editor reference screenshots
are not included. Application image assets and source/configuration files are included.
