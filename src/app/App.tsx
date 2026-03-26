// src/app/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";

import ApplicationsListPage from "../pages/applications/ApplicationsListPage";
import ApplicationDetailPage from "../pages/applications/ApplicationDetailPage";
import IntegrationsPage from "../pages/integrations/IntegrationsPage";
import PlatformsPage from "../pages/platforms/PlatformsPage";

export default function App() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/applications" replace />} />

                <Route path="/applications" element={<ApplicationsListPage />} />
                <Route
                    path="/applications/:applicationId"
                    element={<ApplicationDetailPage />}
                />

                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/platforms" element={<PlatformsPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/applications" replace />} />
            </Route>
        </Routes>
    );
}
