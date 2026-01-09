# Ultimate Inventory System

## Getting Started

- Create a local env file at `.env.local` (this file is not committed). You can copy keys from `.env.example`.
- Install dependencies with `npm install`.
- Start the dev server with `npm run dev` and open `http://localhost:3000`.

## Local Database

- Required env var: `DATABASE_URL` (set it in `.env.local`; `.env.local` is not committed).
- Local Postgres: run Postgres locally (for example via Docker) using the container name `intake-postgres`.
- Data table: `inventory_items`
- Columns: `id`, `title`, `sku`, `brand`, `category`, `condition`, `price_cents`, `notes`, `created_at`
- Initialization: the SQL schema file for creating `inventory_items` will be added in an upcoming PR; once available, run it against your local Postgres database to create the table.
- Verification checklist:
  - Postgres is running locally (or via Docker) and the container is named `intake-postgres`.
  - `DATABASE_URL` points to your local Postgres instance and the `intake` database.
  - The `inventory_items` table exists and includes the columns listed above.
  - The dev server starts and the home page loads in the browser.
