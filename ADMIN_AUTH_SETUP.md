# Settlem Academy — Admin Authentication

1. Create `backend/.env` from `.env.example`.
2. Set `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD`.
3. Run:
```bash
cd backend
npm install
npm run seed:admin
npm start
```
4. Serve the frontend through a local web server and open `admin-login.html`.

The admin login stores a JWT only after the backend confirms the account has the `admin` role. The admin dashboard is guarded, and student management can load central student data.

For production: HTTPS, managed database, secret management, rate limiting, password reset/email verification, audit logs, backups and monitoring are still required.
