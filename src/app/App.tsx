// src/app/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { CurrentUserProvider, useCurrentUser } from "../hooks/useCurrentUser";
import AppLayout from "../layouts/AppLayout";

import HomePage from "../pages/HomePage";
import ApplicationsListPage from "../pages/applications/ApplicationsListPage";
import ApplicationDetailPage from "../pages/applications/ApplicationDetailPage";
import CreateApplicationPage from "../pages/applications/CreateApplicationPage";
import EditApplicationPage from "../pages/applications/EditApplicationPage";
import CreateCapabilityPage from "../pages/capabilities/CreateCapabilityPage";
import EditCapabilityPage from "../pages/capabilities/EditCapabilityPage";
import CapabilityDetailPage from "../pages/capabilities/CapabilityDetailPage";
import AdminPage from "../pages/admin/AdminPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import IntegrationsPage from "../pages/integrations/IntegrationsPage";
import PlatformsPage from "../pages/platforms/PlatformsPage";

function NoAccessScreen() {
    return (
        <div className="no-access-screen">
            <h2>Access Not Configured</h2>
            <p>You are signed in, but your CMDB access has not been configured.</p>
            <p>Please contact a PlatformAdmin to request access.</p>
        </div>
    );
}

function LoadingScreen() {
    return (
        <div className="loading-screen">
            <p>Loading...</p>
        </div>
    );
}

function AuthAwareRouter() {
    const { user, loading, error } = useCurrentUser();

    if (loading) {
        return <LoadingScreen />;
    }

    if (error) {
        return (
            <div className="error-screen">
                <h2>Unable to Load</h2>
                <p>Could not verify your account: {error}</p>
            </div>
        );
    }

    if (!user?.isAuthenticated) {
        return (
            <div className="signed-out-screen">
                <h2>Not Signed In</h2>
                <p>Please sign in to access this application.</p>
            </div>
        );
    }

    if (user.isAuthenticated && !user.userRecord) {
        return <NoAccessScreen />;
    }

    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />

                <Route path="/applications" element={<ApplicationsListPage />} />
                <Route path="/applications/new" element={<CreateApplicationPage />} />
                <Route
                    path="/applications/:applicationId"
                    element={<ApplicationDetailPage />}
                />
                <Route
                    path="/applications/:applicationId/edit"
                    element={<EditApplicationPage />}
                />

                <Route path="/capabilities/new" element={<CreateCapabilityPage />} />
                <Route path="/capabilities/:id" element={<CapabilityDetailPage />} />
                <Route path="/capabilities/:id/edit" element={<EditCapabilityPage />} />

                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />

                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/platforms" element={<PlatformsPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/applications" replace />} />
            </Route>
        </Routes>
    );
}

export default function App() {
    return (
        <CurrentUserProvider>
            <AuthAwareRouter />
        </CurrentUserProvider>
    );
}