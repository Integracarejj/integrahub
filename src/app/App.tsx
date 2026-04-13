// src/app/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
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
import IntegrationsPage from "../pages/integrations/IntegrationsPage";
import PlatformsPage from "../pages/platforms/PlatformsPage";

export default function App() {
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

                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/platforms" element={<PlatformsPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/applications" replace />} />
            </Route>
        </Routes>
    );
}
