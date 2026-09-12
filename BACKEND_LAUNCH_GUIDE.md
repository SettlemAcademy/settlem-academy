# Settlem Academy — Backend Integration & Launch Plan

## 1. Start the API
Open a terminal:
```bash
cd backend
npm install
```
Copy `.env.example` to `.env`, set a strong `JWT_SECRET`, then:
```bash
npm start
```
API: `http://localhost:4000`

## 2. Serve the website
Do not open the HTML with `file://` when testing API login. Serve the project with a local web server, for example:
```bash
npx serve .
```
Then open the address shown by `serve`.

## 3. What is connected
- Student login/register now attempts the central API.
- Student dashboard loads central account/enrollment data when a valid token exists.
- Learning Room sends lesson completion to the API when authenticated.
- Existing browser-local fallback remains so the UI can still be previewed without a running server.

## 4. Production checklist
Before accepting real student accounts:
- Deploy API behind HTTPS.
- Use a managed PostgreSQL/MySQL database for production rather than local SQLite.
- Set a long random JWT secret in the hosting provider's secret/environment settings.
- Add rate limiting, email verification, password reset and audit logging.
- Add role-protected admin login.
- Move video/material/test management from localStorage to authenticated API endpoints.
- Configure backups and monitoring.
- Add a real domain such as your chosen Settlem Academy domain.

This is an integration foundation, not a claim that the local demo is production-secure.
