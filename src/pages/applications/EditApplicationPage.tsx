import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getAuthHeaders } from "../../utils/authHeaders";
import "./CreateApplicationPage.css";

interface Capability {
    id: string;
    name: string;
}



export default function EditApplicationPage() {
    const { applicationId } = useParams<{ applicationId: string }>();
    const navigate = useNavigate();

    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [loadingCapabilities, setLoadingCapabilities] = useState(true);
    const [loadingApp, setLoadingApp] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        capabilityId: "",
        status: "Active",
        type: "",
        businessOwner: "",
        businessCriticality: "",
        impactIfDown: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        Promise.all([
            fetch("/api/capabilities").then((res) => res.json()),
            fetch(`/api/applications/${applicationId}`).then((res) => {
                if (!res.ok) throw new Error("Application not found");
                return res.json();
            }),
        ])
            .then(([capsData, appData]) => {
                setCapabilities(capsData);
                setForm({
                    name: appData.name || "",
                    capabilityId: appData.capabilityId || "",
                    status: appData.status || "Active",
                    type: appData.type || "",
                    businessOwner: appData.ownership?.businessOwner || "",
                    businessCriticality: appData.businessContext?.businessCriticality || "",
                    impactIfDown: appData.businessContext?.impactIfDown || "",
                });
                setLoadingCapabilities(false);
                setLoadingApp(false);
            })
            .catch((err) => {
                setError(err.message || "Failed to load application");
                setLoadingCapabilities(false);
                setLoadingApp(false);
            });
    }, [applicationId]);

    function validate(): boolean {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = "Name is required";
        if (!form.capabilityId) newErrors.capabilityId = "Capability is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function handleChange(field: string, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`/api/applications/${applicationId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to update application");
                return;
            }

            navigate(`/applications/${applicationId}`);
        } catch (err) {
            setError("Failed to update application");
        } finally {
            setSubmitting(false);
        }
    }

    if (loadingApp || loadingCapabilities) {
        return <div className="create-application-page"><p>Loading...</p></div>;
    }

    if (error && loadingApp) {
        return <div className="create-application-page"><p>{error}</p></div>;
    }

    return (
        <div className="create-application-page">
            <header className="page-header">
                <h1>Edit Application</h1>
                <Link to={`/applications/${applicationId}`} className="back-link">Back to Application</Link>
            </header>

            {error && !loadingApp && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="create-form">
                <div className="form-field">
                    <label htmlFor="id">ID</label>
                    <input id="id" type="text" value={applicationId} disabled />
                </div>

                <div className="form-field">
                    <label htmlFor="name">Name *</label>
                    <input
                        id="name"
                        type="text"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        disabled={submitting}
                    />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                </div>

                <div className="form-field">
                    <label htmlFor="capabilityId">Capability *</label>
                    <select
                        id="capabilityId"
                        value={form.capabilityId}
                        onChange={(e) => handleChange("capabilityId", e.target.value)}
                        disabled={submitting}
                    >
                        <option value="">Select a capability</option>
                        {capabilities.map((cap) => (
                            <option key={cap.id} value={cap.id}>
                                {cap.name}
                            </option>
                        ))}
                    </select>
                    {errors.capabilityId && <span className="field-error">{errors.capabilityId}</span>}
                </div>

                <div className="form-field">
                    <label htmlFor="status">Status</label>
                    <select
                        id="status"
                        value={form.status}
                        onChange={(e) => handleChange("status", e.target.value)}
                        disabled={submitting}
                    >
                        <option value="Active">Active</option>
                        <option value="Planned">Planned</option>
                        <option value="Retired">Retired</option>
                    </select>
                </div>

                <div className="form-field">
                    <label htmlFor="type">Type</label>
                    <select
                        id="type"
                        value={form.type}
                        onChange={(e) => handleChange("type", e.target.value)}
                        disabled={submitting}
                    >
                        <option value="">Select type</option>
                        <option value="Standard">Standard</option>
                        <option value="Platform">Platform</option>
                        <option value="SaaS">SaaS</option>
                    </select>
                </div>

                <div className="form-field">
                    <label htmlFor="businessOwner">Business Owner</label>
                    <input
                        id="businessOwner"
                        type="text"
                        value={form.businessOwner}
                        onChange={(e) => handleChange("businessOwner", e.target.value)}
                        disabled={submitting}
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="businessCriticality">Business Criticality</label>
                    <select
                        id="businessCriticality"
                        value={form.businessCriticality}
                        onChange={(e) => handleChange("businessCriticality", e.target.value)}
                        disabled={submitting}
                    >
                        <option value="">Select criticality</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                    </select>
                </div>

                <div className="form-field">
                    <label htmlFor="impactIfDown">Impact If Down</label>
                    <textarea
                        id="impactIfDown"
                        value={form.impactIfDown}
                        onChange={(e) => handleChange("impactIfDown", e.target.value)}
                        rows={3}
                        disabled={submitting}
                    />
                </div>

                <div className="form-actions">
                    <Link to={`/applications/${applicationId}`} className="btn-cancel">Cancel</Link>
                    <button type="submit" className="btn-submit" disabled={submitting}>
                        {submitting ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
