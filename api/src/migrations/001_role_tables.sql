-- Migration: 001_role_tables.sql
-- Creates foundation tables for future role-based access control
-- Run this against cmdb database
-- Do NOT run more than once - subsequent runs will fail on existing tables

-- cmdb.Users: Stores Azure AD-backed user identities
-- id is Azure AD objectId (GUID format)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE cmdb.Users (
        id VARCHAR(255) PRIMARY KEY,
        displayName NVARCHAR(255) NULL,
        email NVARCHAR(255) NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'Viewer',
        createdAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT chk_user_role CHECK (role IN ('Viewer', 'PlatformAdmin'))
    );

    CREATE INDEX idx_users_role ON cmdb.Users(role);
END
ELSE
    PRINT 'Table cmdb.Users already exists - skipping';
GO

-- cmdb.ApplicationRoleAssignments: Per-application role assignments
-- Supports 1 AppOwner and up to 2 AppAdmins per application
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationRoleAssignments')
BEGIN
    CREATE TABLE cmdb.ApplicationRoleAssignments (
        id VARCHAR(50) PRIMARY KEY,
        applicationId VARCHAR(50) NOT NULL,
        userId VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        createdAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_app_assign_app FOREIGN KEY (applicationId) 
            REFERENCES cmdb.Applications(id),
        CONSTRAINT fk_app_assign_user FOREIGN KEY (userId) 
            REFERENCES cmdb.Users(id),
        CONSTRAINT chk_app_role CHECK (role IN ('AppOwner', 'AppAdmin'))
    );

    CREATE INDEX idx_app_assign_app ON cmdb.ApplicationRoleAssignments(applicationId);
    CREATE INDEX idx_app_assign_user ON cmdb.ApplicationRoleAssignments(userId);

    -- Constraint: Only 1 AppOwner per application
    -- Implemented via application logic (not CHECK constraint due to partial uniqueness)
END
ELSE
    PRINT 'Table cmdb.ApplicationRoleAssignments already exists - skipping';
GO

-- Optional: Add audit fields to existing tables for tracking who made changes
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Applications') AND name = 'createdBy'
)
BEGIN
    ALTER TABLE cmdb.Applications ADD createdBy VARCHAR(255) NULL;
    ALTER TABLE cmdb.Applications ADD updatedBy VARCHAR(255) NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.Capabilities') AND name = 'createdBy'
)
BEGIN
    ALTER TABLE cmdb.Capabilities ADD createdBy VARCHAR(255) NULL;
    ALTER TABLE cmdb.Capabilities ADD updatedBy VARCHAR(255) NULL;
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('cmdb.ApplicationIntegrations') AND name = 'createdBy'
)
BEGIN
    ALTER TABLE cmdb.ApplicationIntegrations ADD createdBy VARCHAR(255) NULL;
    ALTER TABLE cmdb.ApplicationIntegrations ADD updatedBy VARCHAR(255) NULL;
END
GO

PRINT 'Migration 001 complete';
