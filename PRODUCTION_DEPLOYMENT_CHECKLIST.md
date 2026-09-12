# Settlem Academy — Production Deployment Checklist

## Recommended architecture
- Frontend: static hosting (Vercel / Netlify / Cloudflare Pages)
- API: Node.js hosting (Render / Railway / Fly.io / VPS)
- Database: managed PostgreSQL
- Domain: your Settlem Academy domain
- HTTPS: enabled everywhere

## Before launch
1. Move SQLite development data to PostgreSQL.
2. Set a long random `JWT_SECRET` in the server environment.
3. Set production `FRONTEND_ORIGIN`.
4. Create the admin account using `seed-admin.js` or a secure server-side provisioning process.
5. Disable development/demo fallbacks where appropriate.
6. Add rate limiting and request validation.
7. Add password reset and email verification.
8. Configure database backups.
9. Add monitoring and error logging.
10. Test registration, login, enrollment, video lessons, materials, tests, scoring and progress on mobile and desktop.

## Current development launch
```bash
cd backend
npm install
npm run seed:admin
npm start
```

Serve the frontend using a web server rather than opening HTML files directly with `file://`.

## Important
The current backend is a development foundation. Do not treat SQLite + localStorage fallback as the final production architecture.
