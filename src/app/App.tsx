import { useState } from "react";
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
import AdminApplicationImportPage from "../pages/admin/AdminApplicationImportPage";
import AdminDataQualityPage from "../pages/admin/AdminDataQualityPage";
import IntegrationsPage from "../pages/integrations/IntegrationsPage";
import PlatformsPage from "../pages/platforms/PlatformsPage";
import CapabilityViewPage from "../pages/explore/CapabilityViewPage";
import DepartmentViewPage from "../pages/explore/DepartmentViewPage";
import ProcessListPage from "../pages/processes/ProcessListPage";
import ProcessDetailPage from "../pages/processes/ProcessDetailPage";
import PerformancePage from "../pages/performance/PerformancePage";
import MaintenanceCompliancePage from "../pages/performance/MaintenanceCompliancePage";

function NoAccessScreen() {
    const [showRequest, setShowRequest] = useState(false);

    return (
        <div className="no-access-screen">
            <h2>You do not currently have access to IntegraSource.</h2>
            <p>Your Microsoft account was verified, but access to this application has not been granted.</p>
            <button
                className="admin-btn"
                onClick={() => setShowRequest(true)}
                style={{ marginTop: 24 }}
            >
                Request Access
            </button>
            {showRequest && (
                <p style={{ marginTop: 16, color: "#6b7280", fontSize: 14 }}>
                    Access request workflow coming soon. Please contact your IntegraSource administrator.
                </p>
            )}
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

    if (user.isAuthenticated && !user.hasAppAccess) {
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
                <Route path="/admin/application-import" element={<AdminApplicationImportPage />} />
                <Route path="/admin/data-quality" element={<AdminDataQualityPage />} />

                <Route path="/processes" element={<ProcessListPage />} />
                <Route path="/processes/:id" element={<ProcessDetailPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/performance/maintenance-compliance" element={<MaintenanceCompliancePage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/platforms" element={<PlatformsPage />} />
                <Route path="/capability-view" element={<CapabilityViewPage />} />
                <Route path="/department-view" element={<DepartmentViewPage />} />

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
