# Settlem Academy — Free Render Blueprint

This version uses PostgreSQL instead of SQLite, so the web service does not depend on a persistent disk. The `render.yaml` creates a Free Render Web Service and a Free Render Postgres database and wires `DATABASE_URL` automatically.

## Deploy
1. Commit/push these backend files to the GitHub repository root.
2. In Render choose **New → Blueprint** (or create from the repository's `render.yaml`).
3. Select the GitHub repository and review the two resources: `settlem-academy-api` and `settlem-academy-db`.
4. Keep the web service on **Free**.
5. Deploy the Blueprint.
6. After deployment, open the API URL and check `/api/health`. It should return `ok: true` and `database: postgres`.

## Admin account
Because Free Render web services do not provide dashboard shell access, this package includes a one-time bootstrap endpoint. In Render, add a secret environment variable named `ADMIN_BOOTSTRAP_SECRET` with a long random value. After deployment, send one POST request to `/api/admin/bootstrap` with header `x-bootstrap-secret` and JSON `{ "name": "...", "email": "...", "password": "..." }`. It will create the first admin only; after an admin exists the endpoint returns `409`. Remove the `ADMIN_BOOTSTRAP_SECRET` environment variable after creating the admin.

For a production system, use a paid database with backups and a stronger operational setup. Render's Free Postgres databases currently expire after 30 days.
