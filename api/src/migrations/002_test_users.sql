-- Test users for RBAC development testing only
-- DELETE these records when removing dev-only auth override

-- test-user-001: Viewer + AppOwner on app-azuread
IF NOT EXISTS (SELECT * FROM cmdb.Users WHERE id = 'test-user-001')
BEGIN
    INSERT INTO cmdb.Users (id, displayName, email, role)
    VALUES ('test-user-001', 'Test Owner User', 'test-owner@cmdb.local', 'Viewer');
END

IF NOT EXISTS (SELECT * FROM cmdb.ApplicationRoleAssignments WHERE id = 'ara-001')
BEGIN
    INSERT INTO cmdb.ApplicationRoleAssignments (id, applicationId, userId, role)
    VALUES ('ara-001', 'app-azuread', 'test-user-001', 'AppOwner');
END

-- test-user-002: Viewer with NO application assignment
IF NOT EXISTS (SELECT * FROM cmdb.Users WHERE id = 'test-user-002')
BEGIN
    INSERT INTO cmdb.Users (id, displayName, email, role)
    VALUES ('test-user-002', 'Test Viewer User', 'test-viewer@cmdb.local', 'Viewer');
END

-- test-admin-001: PlatformAdmin (global super admin)
IF NOT EXISTS (SELECT * FROM cmdb.Users WHERE id = 'test-admin-001')
BEGIN
    INSERT INTO cmdb.Users (id, displayName, email, role)
    VALUES ('test-admin-001', 'Test Platform Admin', 'test-admin@cmdb.local', 'PlatformAdmin');
END

PRINT 'Test users created';
