-- Migration: 005_role_view.sql
-- Creates role definitions and system-role usage tables for Role View

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RoleDefinitions')
BEGIN
    CREATE TABLE cmdb.RoleDefinitions (
        id VARCHAR(50) PRIMARY KEY,
        roleCode VARCHAR(20) NOT NULL,
        roleName NVARCHAR(255) NOT NULL,
        roleGroup NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,
        isActive BIT DEFAULT 1,
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX idx_roles_code ON cmdb.RoleDefinitions(roleCode);
    CREATE INDEX idx_roles_group ON cmdb.RoleDefinitions(roleGroup);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemRoleUsage')
BEGIN
    CREATE TABLE cmdb.SystemRoleUsage (
        id VARCHAR(50) PRIMARY KEY,
        applicationId VARCHAR(50) NOT NULL,
        roleDefinitionId VARCHAR(50) NOT NULL,
        usageType VARCHAR(50) NOT NULL,
        usagePurpose NVARCHAR(500) NULL,
        isPrimary BIT DEFAULT 0,
        notes NVARCHAR(1000) NULL,
        createdAt DATETIME2 DEFAULT GETDATE(),
        updatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_sru_app FOREIGN KEY (applicationId) REFERENCES cmdb.Applications(id),
        CONSTRAINT fk_sru_role FOREIGN KEY (roleDefinitionId) REFERENCES cmdb.RoleDefinitions(id)
    );

    CREATE INDEX idx_sru_app ON cmdb.SystemRoleUsage(applicationId);
    CREATE INDEX idx_sru_role ON cmdb.SystemRoleUsage(roleDefinitionId);
END
GO

-- Seed roles
IF NOT EXISTS (SELECT * FROM cmdb.RoleDefinitions WHERE id = 'role-agm')
BEGIN
    INSERT INTO cmdb.RoleDefinitions (id, roleCode, roleName, roleGroup, description, isActive)
    VALUES
    ('role-agm', 'AGM', 'Area General Manager', 'Leadership', 'Oversees overall community operations and strategy', 1),
    ('role-eoo', 'EOO', 'Executive Operations Officer', 'Leadership', 'Manages daily executive operations and staff coordination', 1),
    ('role-asd', 'ASD', 'Administrative Systems Director', 'Administration', 'Oversees administrative systems and technology infrastructure', 1),
    ('role-rwd', 'RWD', 'Resident Wellness Director', 'Resident Care', 'Manages resident wellness programs and health services', 1),
    ('role-lstad', 'LSTaD', 'LifeStages Director', 'Resident Care', 'Coordinates life-stage programs for residents', 1),
    ('role-lstod', 'LSToD', 'LifeStories Director', 'Resident Care', 'Manages resident storytelling and life documentation', 1),
    ('role-crd', 'CRD', 'Community Relations Director', 'Sales / Marketing', 'Leads community outreach and resident relations', 1),
    ('role-ded', 'DED', 'Dining Experience Director', 'Dining', 'Oversees dining services and resident meal experience', 1),
    ('role-obs', 'OBS', 'Onboard Specialist', 'Operations', 'Manages resident and staff onboarding processes', 1),
    ('role-cra', 'CRA', 'Community Relations Associate', 'Sales / Marketing', 'Supports community relations and marketing events', 1),
    ('role-exec', 'Exec', 'Leadership', 'Leadership', 'Executive leadership role overseeing all communities', 1),
    ('role-sme', 'SME', 'Safety & Maintenance', 'Maintenance / Safety', 'Manages facility safety, maintenance, and compliance', 1);
END
GO
