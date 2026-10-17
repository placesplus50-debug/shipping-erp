# Super Admin rollout — preview only

**Status:** Code committed on feature/d1-auth. D1 migration NOT executed. No admin created. Production main untouched.

## Safety gate
Preview and Production point to the SAME D1 database shipping-pulse-db (f011e253-b6e2-4954-9d4c-99e8462e8fce). Export a verified D1 backup before any schema change. Inspect the live table definition first:

```sql
SELECT name,sql FROM sqlite_master WHERE type IN ('table','index') AND name IN ('users','sessions','audit_logs','user_permissions');
SELECT COUNT(*) AS user_count FROM users;
PRAGMA table_info(users);
PRAGMA foreign_key_list(sessions);
```

Do not run migration 0003 without comparing its columns and constraints to the actual live schema. In particular, dropping and recreating users can break referencing foreign keys, triggers, indexes or data if the live schema differs. Prefer a migration generated from the actual schema. Keep a rollback plan and do not run on a shared database during active usage.

## Required schema
users.role must permit super_admin, admin, accountant, driver; user_permissions must exist with columns user_id, permission, granted. Check exact columns of sessions and audit_logs before enabling user-management writes.

## Validation after migration
```sql
PRAGMA foreign_key_check;
SELECT sql FROM sqlite_master WHERE type='table' AND name='users';
SELECT sql FROM sqlite_master WHERE type='table' AND name='user_permissions';
SELECT COUNT(*) AS user_count FROM users;
```

Deploy Preview and test unauthorized GET /api/users returns 403, and POST /api/auth/bootstrap requires a same-origin request, BOOTSTRAP_SECRET and an empty users table. Create first Super Admin only after verifying the migration. Immediately delete BOOTSTRAP_SECRET from Preview. Test login, GET /api/auth/me, user creation and privilege boundaries with non-sensitive test identities. Revoke sessions when deactivating users.

**Do not merge to main:** existing dashboard endpoints are not fully integrated with this RBAC model, and role permissions are not yet enforced across order/collection APIs. No production readiness claim.
