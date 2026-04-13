import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./CreateApplicationPage.css";

interface Capability {
    id: string;
    name: string;
}

export default function CreateApplicationPage() {
    const navigate = useNavigate();

    const [capabilities, setCapabilities] = useState<Capability[]>([]);
    const [loadingCapabilities, setLoadingCapabilities] = useState(true);
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
        fetch("/api/capabilities")
            .then((res) => res.json())
            .then((data) => {
                setCapabilities(data);
                setLoadingCapabilities(false);
            })
            .catch(() => {
                setCapabilities([]);
                setLoadingCapabilities(false);
            });
    }, []);

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
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to create application");
                return;
            }

            navigate(`/applications/${data.id}`);
        } catch (err) {
            setError("Failed to create application");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="create-application-page">
            <header className="page-header">
                <h1>Create Application</h1>
                <Link to="/applications" className="back-link">Back to Applications</Link>
            </header>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="create-form">
                <div className="form-field">
                    <label htmlFor="name">Name *</label>
                    <input
                        id="name"
                        type="text"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="e.g., Paycor"
                        disabled={submitting}
                    />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                    <span className="field-hint">Application ID will be auto-generated from name</span>
                </div>

                <div className="form-field">
                    <label htmlFor="capabilityId">Capability *</label>
                    {loadingCapabilities ? (
                        <select id="capabilityId" disabled>
                            <option value="">Loading...</option>
                        </select>
                    ) : (
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
                    )}
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
                        placeholder="e.g., Chief HR Officer"
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
                        placeholder="Describe the impact if this application is unavailable"
                        rows={3}
                        disabled={submitting}
                    />
                </div>

                <div className="form-actions">
                    <Link to="/applications" className="btn-cancel">Cancel</Link>
                    <button type="submit" className="btn-submit" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Application"}
                    </button>
                </div>
            </form>
        </div>
    );
}
