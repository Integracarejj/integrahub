# Dev Testing Guide

## Testing Non-Admin Behavior with x-dev-user-email

In development mode, you can simulate different user roles without needing real Azure authentication.

### How it works

The backend middleware (`api/src/middleware/resolveCurrentUser.js`) checks for the `x-dev-user-email` header. If present, it looks up the user in `cmdb.Users` by email and sets `req.user`.

### Frontend setup

The frontend utility (`src/utils/authHeaders.ts`) automatically adds this header when a dev email is set in localStorage.

### Steps to test as different users

1. **Open browser dev tools** (F12)

2. **Set the dev user email** in localStorage:
   ```javascript
   localStorage.setItem("devUserEmail", "test-viewer@cmdb.local")
   ```

3. **Refresh the page** - the app will now authenticate as that user

4. **Test different roles**:
   - `test-viewer@cmdb.local` - Viewer with no app assignments
   - `test-owner@cmdb.local` - Viewer with AppOwner assignment on app-azuread
   - `test-admin@cmdb.local` - PlatformAdmin

5. **Clear dev user** to go back to unauthenticated:
   ```javascript
   localStorage.removeItem("devUserEmail")
   ```

### Test scenarios

| Email | Expected Behavior |
|-------|-------------------|
| Not set | Unauthenticated, read-only access |
| test-viewer@cmdb.local | Can view, cannot edit anything |
| test-owner@cmdb.local | Can view all, can edit app-azuread only |
| test-admin@cmdb.local | Full admin access to everything |

### Notes

- This only works in development mode where the backend is accessible
- The email must exist in `cmdb.Users` table
- Seed test users using `api/src/migrations/002_test_users.sql`
- DO NOT use this pattern in production - it's for dev testing only
