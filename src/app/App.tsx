import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { CurrentUserProvider, useCurrentUser } from "../hooks/useCurrentUser";
import AppLayout from "../layouts/AppLayout";
import PortalLayout from "../layouts/PortalLayout";

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
import TopicsPage from "../pages/topics/TopicsPage";
import TopicDetailPage from "../pages/topics/TopicDetailPage";

import PortalOverview from "../pages/portal/PortalOverview";
import PortalTransactions from "../pages/portal/PortalTransactions";
import PortalRequests from "../pages/portal/PortalRequests";
import PortalSubmit from "../pages/portal/PortalSubmit";
import PortalDocuments from "../pages/portal/PortalDocuments";
import PortalHelp from "../pages/portal/PortalHelp";

import RecapitalizationOverview from "../pages/recapitalization/RecapitalizationOverview";
import RecapitalizationTransactions from "../pages/recapitalization/RecapitalizationTransactions";
import RecapitalizationTracker from "../pages/recapitalization/RecapitalizationTracker";
import RecapitalizationIntake from "../pages/recapitalization/RecapitalizationIntake";
import RecapitalizationMyWork from "../pages/recapitalization/RecapitalizationMyWork";
import RecapitalizationDocuments from "../pages/recapitalization/RecapitalizationDocuments";
import RecapitalizationReports from "../pages/recapitalization/RecapitalizationReports";
import RecapitalizationSettings from "../pages/recapitalization/RecapitalizationSettings";
import RecapitalizationWorkspace from "../pages/recapitalization/RecapitalizationWorkspace";

/**
 * Guards internal routes from external portal users.
 * Portal-only users are redirected to /portal.
 * Internal users (including DDTeam with both accesses) can proceed.
 */
function InternalGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useCurrentUser();

    if (loading) return null;

    if (user?.isPortalUser && !user?.hasAppAccess) {
        return <Navigate to="/portal" replace />;
    }

    return <>{children}</>;
}

/**
 * Guards portal routes from purely internal users.
 * Pure internal users see a 403-style message.
 *
 * Exceptions for preview:
 * - Internal PlatformAdmin users can preview /portal with mock data.
 * - DDTeam users already have isPortalUser and pass through naturally.
 */
function PortalGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useCurrentUser();

    if (loading) return null;

    const isPreviewAllowed = user?.hasAppAccess
        && user?.userRecord?.role === "PlatformAdmin";

    if (isPreviewAllowed) {
        return <>{children}</>;
    }

    if (!user?.isPortalUser) {
        return (
            <div className="no-access-screen">
                <h2>Portal Access Required</h2>
                <p>You do not have access to the Recapitalization Portal. Contact the DD team for access.</p>
            </div>
        );
    }

    return <>{children}</>;
}

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

    if (user.isAuthenticated && !user.hasAppAccess && !user.isPortalUser) {
        return <NoAccessScreen />;
    }

    return (
        <Routes>
            <Route element={<InternalGuard><AppLayout /></InternalGuard>}>
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
                <Route path="/topics" element={<TopicsPage />} />
                <Route path="/topics/:topicSlug" element={<TopicDetailPage />} />

                <Route path="/recapitalization" element={<RecapitalizationOverview />} />
                <Route path="/recapitalization/transactions" element={<RecapitalizationTransactions />} />
                <Route path="/recapitalization/tracker" element={<RecapitalizationTracker />} />
                <Route path="/recapitalization/intake/*" element={<RecapitalizationIntake />} />
                <Route path="/recapitalization/my-work" element={<RecapitalizationMyWork />} />
                <Route path="/recapitalization/documents" element={<RecapitalizationDocuments />} />
                <Route path="/recapitalization/reports" element={<RecapitalizationReports />} />
                <Route path="/recapitalization/settings" element={<RecapitalizationSettings />} />
                <Route path="/recapitalization/workspace/:id" element={<RecapitalizationWorkspace />} />

                <Route path="*" element={<Navigate to="/applications" replace />} />
            </Route>

            <Route element={<PortalGuard><PortalLayout /></PortalGuard>}>
                <Route path="/portal" element={<PortalOverview />} />
                <Route path="/portal/transactions" element={<PortalTransactions />} />
                <Route path="/portal/requests" element={<PortalRequests />} />
                <Route path="/portal/submit" element={<PortalSubmit />} />
                <Route path="/portal/documents" element={<PortalDocuments />} />
                <Route path="/portal/help" element={<PortalHelp />} />

                <Route path="/portal/questions" element={<Navigate to="/portal/submit?type=question" replace />} />
                <Route path="/portal/clarifications" element={<Navigate to="/portal/submit?type=clarification" replace />} />
                <Route path="/portal/new-request" element={<Navigate to="/portal/submit?type=new-request" replace />} />
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
