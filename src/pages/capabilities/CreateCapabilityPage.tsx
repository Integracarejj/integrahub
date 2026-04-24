import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import { getAuthHeaders } from "../../utils/authHeaders";
import "../applications/CreateApplicationPage.css";

export default function CreateCapabilityPage() {
    const navigate = useNavigate();
    const permissions = usePermissions();

    const [name, setName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    if (!isPlatformAdmin(permissions)) {
        return (
            <div className="create-application-page" style={{ padding: "40px", textAlign: "center" }}>
                <h1>Access Denied</h1>
                <p>You do not have access to this page.</p>
                <Link to="/" className="create-btn">Go to Home</Link>
            </div>
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!name.trim()) {
            setValidationError("Name is required");
            return;
        }

        setSubmitting(true);
        setError(null);
        setValidationError(null);

        try {
            const res = await fetch("/api/capabilities", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ name }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to create capability");
                return;
            }

            navigate(`/capabilities/${data.id}`);
        } catch (err) {
            setError("Failed to create capability");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="create-application-page">
            <header className="page-header">
                <h1>Create Capability</h1>
                <Link to="/applications" className="back-link">Back to Applications</Link>
            </header>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="create-form">
                <div className="form-field">
                    <label htmlFor="name">Name *</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Human Resources"
                        disabled={submitting}
                    />
                    {validationError && <span className="field-error">{validationError}</span>}
                </div>

                <div className="form-actions">
                    <Link to="/applications" className="btn-cancel">Cancel</Link>
                    <button type="submit" className="btn-submit" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Capability"}
                    </button>
                </div>
            </form>
        </div>
    );
}