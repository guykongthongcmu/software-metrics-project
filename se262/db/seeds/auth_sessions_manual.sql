-- Manual seed for auth/session testing in Postman.
-- Run with:
-- 1) docker compose up -d mysql
-- 2) docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/auth_sessions_manual.sql
--
-- Notes:
-- - `userSession` below is a real user-session token for /api/client endpoints.
-- - `adminSession` below is currently used by placeholder admin middleware together with `x-role: admin`.
-- - TODO: when real admin session persistence is implemented, replace this with true admin session seeding.

START TRANSACTION;

-- Upsert a user reserved for admin-placeholder requests.
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  date_of_birth,
  phone_number,
  preferred_language,
  email_verified_at
)
VALUES (
  'auth.seed.admin@local.test',
  'seed-hash',
  'Auth',
  'AdminSeed',
  '1998-01-01',
  '0890000001',
  'EN',
  NOW()
)
ON DUPLICATE KEY UPDATE
  user_id = LAST_INSERT_ID(user_id),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  phone_number = VALUES(phone_number),
  preferred_language = VALUES(preferred_language),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;
SET @auth_seed_admin_user_id = LAST_INSERT_ID();

-- Upsert a regular user for /api/client authenticated endpoint testing.
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  date_of_birth,
  phone_number,
  preferred_language,
  email_verified_at
)
VALUES (
  'auth.seed.user@local.test',
  'seed-hash',
  'Auth',
  'UserSeed',
  '1999-01-01',
  '0890000002',
  'EN',
  NOW()
)
ON DUPLICATE KEY UPDATE
  user_id = LAST_INSERT_ID(user_id),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  phone_number = VALUES(phone_number),
  preferred_language = VALUES(preferred_language),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;
SET @auth_seed_user_id = LAST_INSERT_ID();

-- Optional admin table row for future real admin-session wiring.
INSERT INTO admin (
  email,
  password_hash,
  display_name,
  is_active
)
VALUES (
  'auth.seed.admin@local.test',
  'seed-hash',
  'Auth Admin Seed',
  1
)
ON DUPLICATE KEY UPDATE
  admin_id = LAST_INSERT_ID(admin_id),
  display_name = VALUES(display_name),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
SET @auth_seed_admin_id = LAST_INSERT_ID();

-- Revoke other live sessions for these seed principals to keep testing deterministic.
UPDATE sessions
SET revoked_at = NOW()
WHERE (
    (subject_type = 'USER' AND user_id IN (@auth_seed_admin_user_id, @auth_seed_user_id))
    OR
    (subject_type = 'ADMIN' AND admin_id = @auth_seed_admin_id)
  )
  AND session_token NOT IN (
    'dashboard-seed-admin-session-token',
    'dashboard-seed-user-session-token'
  )
  AND revoked_at IS NULL;

-- Upsert fixed tokens used by Postman environment variables.
INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at, revoked_at)
VALUES (
  'ADMIN',
  NULL,
  @auth_seed_admin_id,
  'dashboard-seed-admin-session-token',
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  NULL
)
ON DUPLICATE KEY UPDATE
  subject_type = VALUES(subject_type),
  user_id = VALUES(user_id),
  admin_id = VALUES(admin_id),
  expires_at = VALUES(expires_at),
  revoked_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at, revoked_at)
VALUES (
  'USER',
  @auth_seed_user_id,
  NULL,
  'dashboard-seed-user-session-token',
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  NULL
)
ON DUPLICATE KEY UPDATE
  subject_type = VALUES(subject_type),
  user_id = VALUES(user_id),
  admin_id = VALUES(admin_id),
  expires_at = VALUES(expires_at),
  revoked_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- Copy these into Postman environment variables.
SELECT
  'dashboard-seed-admin-session-token' AS adminSession,
  'dashboard-seed-user-session-token' AS userSession;
