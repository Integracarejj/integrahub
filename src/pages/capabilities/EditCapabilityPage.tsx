import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import { getAuthHeaders } from "../../utils/authHeaders";
import "../applications/CreateApplicationPage.css";

export default function EditCapabilityPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { permissions, loading: permissionsLoading } = usePermissions();

    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/capabilities/${id}`)
            .then((res) => {
                if (!res.ok) throw new Error("Capability not found");
                return res.json();
            })
            .then((data) => {
                setName(data.name || "");
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message || "Failed to load capability");
                setLoading(false);
            });
    }, [id]);

    if (permissionsLoading) {
        return <div className="create-application-page"><p>Loading...</p></div>;
    }

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
            const res = await fetch(`/api/capabilities/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ name }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to update capability");
                return;
            }

            navigate(`/capabilities/${id}`);
        } catch (err) {
            setError("Failed to update capability");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return <div className="create-application-page"><p>Loading...</p></div>;
    }

    if (error && loading) {
        return <div className="create-application-page"><p>{error}</p></div>;
    }

    return (
        <div className="create-application-page">
            <header className="page-header">
                <h1>Edit Capability</h1>
                <Link to="/admin" className="back-link">Back to Admin</Link>
            </header>

            {error && !loading && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="create-form">
                <div className="form-field">
                    <label htmlFor="name">Name *</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={submitting}
                    />
                    {validationError && <span className="field-error">{validationError}</span>}
                </div>

                <div className="form-actions">
                    <Link to="/admin" className="btn-cancel">Cancel</Link>
                    <button type="submit" className="btn-submit" disabled={submitting}>
                        {submitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}