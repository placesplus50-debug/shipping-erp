-- Run on D1 after taking a backup. SQLite CHECK requires table rebuild.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users_new (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 full_name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('super_admin','admin','accountant','driver')),
 driver_id TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users_new(id,full_name,email,password_hash,role,driver_id,is_active,created_at,updated_at)
SELECT id,full_name,email,password_hash,role,driver_id,is_active,created_at,updated_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_driver_id ON users(driver_id) WHERE driver_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_permissions (
 user_id INTEGER NOT NULL,
 permission TEXT NOT NULL CHECK(permission IN ('orders.read','orders.manage','drivers.manage','collections.read','collections.approve','reports.export','users.manage')),
 granted INTEGER NOT NULL CHECK(granted IN (0,1)),
 PRIMARY KEY(user_id,permission),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_key_check;
