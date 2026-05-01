-- Migration: 003_entra_sync_columns.sql
-- Adds columns to cmdb.Users to support Microsoft Graph user sync
-- Run this against cmdb database
-- Safe: only adds nullable columns, does not drop/recreate table or delete data

-- Add entraObjectId column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'entraObjectId'
)
BEGIN
    ALTER TABLE cmdb.Users ADD entraObjectId NVARCHAR(255) NULL;
    CREATE INDEX idx_users_entraObjectId ON cmdb.Users(entraObjectId);
    PRINT 'Added entraObjectId column';
END
ELSE
    PRINT 'entraObjectId column already exists - skipping';

-- Add jobTitle column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'jobTitle'
)
BEGIN
    ALTER TABLE cmdb.Users ADD jobTitle NVARCHAR(255) NULL;
    PRINT 'Added jobTitle column';
END
ELSE
    PRINT 'jobTitle column already exists - skipping';

-- Add department column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'department'
)
BEGIN
    ALTER TABLE cmdb.Users ADD department NVARCHAR(255) NULL;
    PRINT 'Added department column';
END
ELSE
    PRINT 'department column already exists - skipping';

-- Add officeLocation column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'officeLocation'
)
BEGIN
    ALTER TABLE cmdb.Users ADD officeLocation NVARCHAR(255) NULL;
    PRINT 'Added officeLocation column';
END
ELSE
    PRINT 'officeLocation column already exists - skipping';

-- Add managerDisplayName column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'managerDisplayName'
)
BEGIN
    ALTER TABLE cmdb.Users ADD managerDisplayName NVARCHAR(255) NULL;
    PRINT 'Added managerDisplayName column';
END
ELSE
    PRINT 'managerDisplayName column already exists - skipping';

-- Add graphLastSyncedAt column if not exists
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Users') AND name = 'graphLastSyncedAt'
)
BEGIN
    ALTER TABLE cmdb.Users ADD graphLastSyncedAt DATETIME2 NULL;
    PRINT 'Added graphLastSyncedAt column';
END
ELSE
    PRINT 'graphLastSyncedAt column already exists - skipping';

-- Fix CHECK constraint to include Editor role if needed
-- First check if the constraint exists and drop it
IF EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('cmdb.Users') 
    AND name = 'chk_user_role'
)
BEGIN
    ALTER TABLE cmdb.Users DROP CONSTRAINT chk_user_role;
    PRINT 'Dropped old chk_user_role constraint';
END
ELSE
    PRINT 'chk_user_role constraint not found - checking for other role constraints';

-- Check if there's a constraint with different name
IF EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('cmdb.Users')
)
BEGIN
    DECLARE @constraintName NVARCHAR(255);
    SELECT @constraintName = name FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('cmdb.Users');
    
    IF @constraintName IS NOT NULL
    BEGIN
        DECLARE @sql NVARCHAR(MAX) = 'ALTER TABLE cmdb.Users DROP CONSTRAINT ' + @constraintName;
        EXEC sp_executesql @sql;
        PRINT 'Dropped constraint: ' + @constraintName;
    END
END

-- Add updated CHECK constraint with Editor role
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('cmdb.Users')
)
BEGIN
    ALTER TABLE cmdb.Users 
    ADD CONSTRAINT chk_user_role CHECK (role IN ('Viewer', 'Editor', 'PlatformAdmin'));
    PRINT 'Added chk_user_role constraint with Editor role';
END
ELSE
    PRINT 'CHECK constraint already exists - skipping';

PRINT 'Migration 003 complete';
GO
