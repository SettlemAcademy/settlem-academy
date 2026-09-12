# Settlem Academy — Central API Integration Stage

Admin pages now load the shared API client and require an admin session:
- admin-login.html
- admin-dashboard.html
- content-manager.html
- video-manager.html
- materials-manager.html
- test-engine.html
- student-management.html

API helper methods are available for videos, materials and tests.

Important: the existing manager forms still retain their browser localStorage behavior as a fallback. The next hardening pass should change each create/delete action to call the backend first and refresh the central database list after success.

Student-facing enrollment has also been prepared with the API client while preserving local fallback behavior.
