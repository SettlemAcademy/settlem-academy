# Settlem Academy Backend — Ready for Tomorrow

PostgreSQL + Node.js API for Settlem Academy.

## Included
- Secure student registration/login with JWT
- Course enrollment
- Video lessons and study materials
- Practice tests, questions and result storage
- Learning module progress
- Student dashboard data
- Admin student management
- Admin test management
- Announcements
- Course completion certificates + public verification
- Student feedback and 1–5 ratings
- Admin student detail reporting
- Admin overview statistics
- Helmet security headers
- Rate limiting for login/register
- JSON request size limit

## New endpoints in this build
### Feedback
- GET /api/feedback
- POST /api/feedback
- GET /api/admin/feedback

### Reporting
- GET /api/admin/students/:id
- GET /api/admin/overview

## Production environment
Set:
- DATABASE_URL
- JWT_SECRET
- FRONTEND_ORIGIN
- PORT (optional)
- ADMIN_BOOTSTRAP_SECRET (only during one-time admin setup)

## Deploy
Run `npm install` and then `npm start` on the PostgreSQL-enabled Render service.

Do not commit real secrets. Do not deploy until the frontend batch is also finalized and tested.
