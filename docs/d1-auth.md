# Shipping Pulse — D1 authentication (development branch)

This is a **backend-only** implementation on feature/d1-auth. It does not change the current front end or the production main branch.

Endpoints: POST /api/auth/bootstrap (one-time), POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout.
D1 binding: DB. Tables: users, sessions, audit_logs (already created manually).
Passwords: salted PBKDF2-SHA256 (310,000 iterations). Sessions: 256-bit random tokens, SHA-256 hashed in D1, HttpOnly Secure SameSite=Strict cookies, eight-hour expiry. Login/logout audit entries. Same-origin POST protection.
Bootstrap: set a random 32+ character BOOTSTRAP_SECRET as a Cloudflare Pages secret on the test deployment, then send JSON {secret,name,email,password} with password >=14 characters to /api/auth/bootstrap. Only works when users table is empty. **Remove BOOTSTRAP_SECRET immediately afterward. Never commit credentials.**

SECURITY LIMITATIONS BEFORE PRODUCTION:
- Implement login rate limiting (Cloudflare WAF or D1-based throttle) and account lockout to prevent password guessing.
- Existing /api/session and /api/orders still use Cloudflare Access + service account and must be migrated or disabled before exposing real data.
- No Google Sheets bridge, driver order authorization, order status writes, accountant approvals, password reset, or user management yet.
- Test the endpoints on a preview deployment, validate function routing and D1 preview binding, then integrate UI only after review.
- Never send passwords or secrets in chat, URLs, or GitHub.

## Login throttle deployment prerequisites (2026-10-17)
1. In D1 Console for shipping-pulse-db, run the SQL from `migrations/0002_auth_attempts.sql` (only creates the throttle table and index).
2. In Cloudflare Pages **Preview** Variables and Secrets, create secret `AUTH_RATE_LIMIT_KEY` with a securely generated random value of at least 32 characters. Never commit or paste this value in chat.
3. Wait for a new Preview deployment; test /api/auth/me (unauthenticated => HTTP 401) and login rejection without exposing credentials.
4. The current throttle is **per normalized email**, not per IP, and is not a substitute for edge-level rate limiting. Attackers could intentionally lock an email temporarily; review before production.
5. Preview and Production currently use the same D1 database. Never create test admin accounts or alter existing user records as part of these checks.
