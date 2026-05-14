-- Migration: 004_user_access_gate.sql
-- Adds canAccess column to cmdb.Users for explicit app access gating
-- Safe: only adds a nullable column with a default, does not drop/recreate table or delete data

-- Add canAccess column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'canAccess'
)
BEGIN
    ALTER TABLE cmdb.Users ADD canAccess BIT NOT NULL DEFAULT 1;
    PRINT 'Added canAccess column with default 1';
END
ELSE
    PRINT 'canAccess column already exists - skipping';

-- Grant access to PlatformAdmins (safety net)
UPDATE cmdb.Users SET canAccess = 1
WHERE role = 'PlatformAdmin' AND canAccess = 0;
PRINT 'Set canAccess=1 for PlatformAdmins';

-- Grant access to active @integracare.com users
UPDATE cmdb.Users SET canAccess = 1
WHERE isActive = 1
  AND email LIKE '%@integracare.com'
  AND canAccess = 0;
PRINT 'Set canAccess=1 for active @integracare.com users';

-- Revoke access for inactive users
UPDATE cmdb.Users SET canAccess = 0
WHERE isActive = 0 AND canAccess = 1;
PRINT 'Set canAccess=0 for inactive users';

-- Revoke access for non-integracare emails (unless PlatformAdmin already covered above)
UPDATE cmdb.Users SET canAccess = 0
WHERE email NOT LIKE '%@integracare.com'
  AND role != 'PlatformAdmin'
  AND canAccess = 1;
PRINT 'Set canAccess=0 for non-integracare non-admin users';

PRINT 'Migration 004 complete';
GO
