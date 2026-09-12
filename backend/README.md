# Settlem Academy Backend

This folder is the production-oriented backend foundation for the website.

## What it provides
- Central student accounts
- Password hashing with bcrypt
- JWT login sessions
- Student course enrollments
- Video lessons
- Study materials
- Tests and questions
- Test result storage
- Lesson progress
- Student dashboard API
- Admin student API

## Run locally

1. Install Node.js 20+.
2. Open a terminal in this `backend` folder.
3. Run:
   `npm install`
4. Copy `.env.example` to `.env`.
5. Change `JWT_SECRET` to a long random value.
6. Run:
   `npm start`

The API will run on `http://localhost:4000`.

## Important
The existing HTML pages still use browser localStorage. The next integration step is to replace those localStorage calls with these API endpoints. Do not treat the current browser-only login as production authentication until that integration is completed.

For production hosting, use HTTPS and a managed database/backups, and keep secrets in environment variables.
