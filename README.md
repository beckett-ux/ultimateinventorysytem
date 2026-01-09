# Ultimate Inventory System

## Getting Started

- Create a local env file at `.env.local` (this file is not committed). You can copy keys from `.env.example`.
- Install dependencies with `npm install`.
- Start the dev server with `npm run dev` and open `http://localhost:3000`.

## Local Database

- Required env var: `DATABASE_URL` (set it in `.env.local`; `.env.local` is not committed).
- Local Postgres: run Postgres locally (for example via Docker) using the container name `intake-postgres`.
- Canonical schema: `db/schema.sql` (creates the `inventory_items` table).
- Apply the schema to the running `intake-postgres` container using `psql`:
  - PowerShell: `Get-Content db/schema.sql | docker exec -i intake-postgres psql -U postgres -d intake`
  - bash/zsh: `docker exec -i intake-postgres psql -U postgres -d intake < db/schema.sql`
- Verification checklist:
  - Postgres is running locally (or via Docker) and the container is named `intake-postgres`.
  - `DATABASE_URL` points to your local Postgres instance and the `intake` database.
  - The schema applied cleanly and `inventory_items` exists (for example: `docker exec -it intake-postgres psql -U postgres -d intake -c \"\\\\d inventory_items\"`).
  - Start the dev server with `npm run dev`, open `http://localhost:3000`, enter a Title, and click Save.
  - Confirm the UI reports success and returns an `id`.
