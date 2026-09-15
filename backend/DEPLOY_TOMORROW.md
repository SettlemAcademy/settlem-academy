# Tomorrow — Backend Deployment Checklist

1. Confirm the frontend batch is final.
2. Push this backend folder to the SettlemAcademy/settlem-academy repository.
3. Verify Render detects the commit and deploys the Node service.
4. Check GET /api/health and confirm database=postgres.
5. Test student login and admin login.
6. Test enrollment, module progress, certificate issuance, announcements, tests and feedback.
7. Only after backend is healthy, publish the complete frontend ZIP to Netlify once.

No production secrets are included in this package.
