# Settlem Academy — Final Deployment Package

This package is consolidated for deployment.

## Frontend — Netlify

The repository root contains `netlify.toml`, so Netlify will publish the `frontend` directory automatically.

If using Netlify Drop, upload the **contents of the `frontend` folder** rather than the whole project.

## Backend — Render

The repository root contains `render.yaml`. Render should create the Node service using `backend` as its root directory.

Required environment variables:

- `DATABASE_URL` — managed PostgreSQL connection string
- `JWT_SECRET` — long random secret
- `FRONTEND_ORIGIN` — deployed Netlify URL, e.g. `https://your-site.netlify.app`
- `ADMIN_BOOTSTRAP_SECRET` — temporary secret used for the first admin setup

The backend health endpoint is:

`/api/health`

## First production setup

1. Deploy PostgreSQL.
2. Deploy the Render API.
3. Set the four environment variables above.
4. Wait for `/api/health` to report the PostgreSQL service as healthy.
5. Open `admin-setup.html` on the deployed frontend and complete the one-time admin bootstrap.
6. Sign in through `admin-login.html`.
7. Register a test student account.
8. Enroll in B.Tech Mathematics.
9. Confirm the student dashboard, learning room, test, progress and certificate flow.

## Important

The frontend has a fallback/demo mode for local preview, but real student accounts and persistent data require the deployed API and PostgreSQL database.
