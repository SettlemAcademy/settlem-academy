# Settlem Academy — Final Pre-Deployment Checklist

## Verified in this build
- 37 HTML pages present.
- Shared `settlem-api.js` restored and syntax-checked.
- Shared `site-navigation.js` restored and syntax-checked.
- `server.js` syntax-checked.
- Local relative HTML page links checked; dynamic JavaScript template URLs are intentionally excluded from static-file checks.
- Frontend API route references cross-checked against backend routes; dynamic `/:id` paths are intentional.
- Student enrollment flow requires a logged-in student before central API enrollment.
- B.Tech Mathematics enrollment flow requires a logged-in student and opens the Learning Room after enrollment.
- Course selection persists locally for the browser UI and syncs to the API when authenticated.
- Module 04 Probability & Random Variables content is included.
- 20-question Probability test support is included in the backend seed logic.
- Student dashboard, learning room, tests, materials, certificates, feedback and support pages are included.
- Admin pages and role-protected API endpoints are included.
- Contact page contains a Netlify-compatible enquiry form.
- Favicon links added to all HTML pages.
- Mobile responsive layouts are present on the main learning pages.

## Not possible to verify from this environment
- Live Netlify site HTTP response, because external network/DNS access is unavailable in this execution environment.
- Live Render API HTTP response, because external network/DNS access is unavailable.
- Real PostgreSQL authentication/enrollment/test/certificate execution, because it requires the deployed API and database.
- Real YouTube lesson availability for future lessons; no URLs are invented.

## Production requirements before accepting real students
- Deploy the frontend to a static host.
- Deploy the backend to a Node.js host.
- Connect managed PostgreSQL.
- Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, and one-time `ADMIN_BOOTSTRAP_SECRET` securely.
- Run admin bootstrap through `admin-setup.html`.
- Test registration, login, enrollment, progress, test submission, certificate issue/verification, materials, feedback and support on the deployed system.
- Add password reset/email verification before treating accounts as production-ready.
