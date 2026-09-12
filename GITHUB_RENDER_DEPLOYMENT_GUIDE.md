# Settlem Academy — GitHub + Render Deployment Guide

## Step 1 — GitHub Repository
1. Create a repository called `settlem-academy`.
2. Upload all files from this project.
3. Push to the `main` branch.

## Step 2 — Render
1. Create a new Blueprint deployment.
2. Connect your GitHub repository.
3. Render automatically reads `render.yaml`.

## Step 3 — Environment Variables
Set:
- FRONTEND_ORIGIN=https://your-domain.com
- ADMIN_NAME=Settlem Academy Admin
- ADMIN_EMAIL=your-email
- ADMIN_PASSWORD=strong-password

JWT_SECRET is generated automatically.

## Step 4 — First Launch
Render installs dependencies and starts the backend.

Visit:
- /admin-login.html
- /student-login.html
- /api/health

## Step 5 — Custom Domain
Add your domain in Render and enable HTTPS.
