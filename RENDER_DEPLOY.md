# Settlem Academy API — Render deployment

This package is prepared for Render as a Node.js web service. It uses SQLite with a persistent disk path so the development database survives service restarts. For a full production education platform, migrate to managed PostgreSQL before storing significant student data.

## Render
1. Put this backend folder in a Git repository.
2. In Render, create a Web Service from the repository.
3. Root directory: the backend folder (or repository root if this package is the repository).
4. Build command: `npm install`
5. Start command: `npm start`
6. The included `render.yaml` sets HTTPS health checking, a generated JWT secret, the Netlify frontend origin, and a persistent SQLite disk.

## Admin
Do not commit an `.env` file or real credentials. If you need an initial admin, run the seed command in the service shell with secure environment variables:
`npm run seed:admin`

## After deployment
Copy the Render HTTPS service URL. The Netlify frontend must be configured to use that URL instead of the current localhost default.

## Important
This is not a claim of full production security. Add rate limiting, validation, password reset, email verification, monitoring, backups and a managed database before accepting sensitive or high-volume real-world data.
