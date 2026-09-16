# Settlem Academy — Consolidated Repair Package

This package consolidates the production fixes instead of requiring one-by-one browser edits.

## Included fixes
- API client uses the live Render backend `https://settlem-academy-1.onrender.com` and safely normalizes both `/api/*` and `/api`-relative calls.
- Student login uses the real online API only; browser-only demo fallback removed.
- Student dashboard uses server enrollment/progress as the source of truth.
- Compatibility endpoints added for newer dashboard calls: `/api/live-classes`, `/api/points/me`, `/api/leaderboard`, `/api/analytics/student`.
- Retired Netlify API URLs removed from certificate pages and seeded study materials.
- Existing seeded material rows are corrected on server startup.
- Site navigation uses the shared API helper.
