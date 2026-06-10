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

    const SYSTEM_CATEGORIES = [
        "Enterprise System", "Identity & Access", "Analytics & Reporting",
        "HR / Employee Engagement", "HR / Payroll", "Marketing Tool",
        "Sales / Marketing", "CRM / Sales", "Workforce Management",
        "Learning Management", "Clinical / Resident Care", "Clinical / Pharmacy",
        "Clinical / eMAR", "Clinical / Resident Safety", "Clinical / Resident Engagement",
        "Collaboration / Document Management", "Financial / Accounting",
        "Vendor Portal", "Utility / Admin Tool", "Infrastructure Platform",
        "Operations & Facilities", "Other",
    ];

    const ARCHITECTURE_TYPES = [
        "SaaS", "Database", "Platform", "Identity Provider", "Reporting",
        "File Repository", "Integration Layer", "Internal Application",
        "External Vendor", "Manual Process", "Unknown",
    ];

    const MOBILE_SUPPORT_TYPES = [
        "Unknown", "None", "Responsive Web", "Native iOS",
        "Native Android", "Native iOS + Android", "Mixed",
    ];

    const API_AVAILABILITIES = [
        "Unknown", "No Public API", "Vendor API Available",
        "Internal API Available", "API Available - Documentation Needed",
    ];

    const REPORTING_SOURCES = [
        "Unknown", "Vendor Reporting", "Power BI", "Azure SQL",
        "System Reports", "Manual Export", "Mixed",
    ];

    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [loadingDepartments, setLoadingDepartments] = useState(true);

    const [form, setForm] = useState({
        name: "",
        capabilityId: "",
        status: "Active",
        type: "",
        systemCategory: "",
        architectureType: "",
        mobileSupportType: "",
        apiAvailability: "",
        reportingSource: "",
        businessOwner: "",
        businessCriticality: "",
        impactIfDown: "",
        websiteUrl: "",
        loginUrl: "",
        backupOwner: "",
        ssoSupported: "",
        ssoEnabled: "",
        mfaSupported: "",
        mfaEnabled: "",
        dataClassification: "",
        userCountBand: "",
        lastReviewedAt: "",
        notes: "",
        primaryUseCases: "",
        departmentsSupported: "",
        departmentIds: [] as string[],
        accessRequestProcess: "",
        trainingDocumentationUrl: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        Promise.all([
            fetch("/api/capabilities").then((res) => res.json()),
            fetch(`/api/applications/${applicationId}`).then((res) => {
                if (!res.ok) throw new Error("Application not found");
                return res.json();
            }),
            fetch("/api/departments").then((res) => res.json()),
        ])
            .then(([capsData, appData, deptData]) => {
                setCapabilities(capsData);
                setDepartments(deptData);
                setForm({
                    name: appData.name || "",
                    capabilityId: appData.capabilityId || "",
                    status: appData.status || "Active",
                    type: appData.type || "",
                    systemCategory: appData.systemCategory || "",
                    architectureType: appData.architectureType || "",
                    mobileSupportType: appData.mobileSupportType || "",
                    apiAvailability: appData.apiAvailability || "",
                    reportingSource: appData.reportingSource || "",
                    businessOwner: appData.ownership?.businessOwner || "",
                    businessCriticality: appData.businessContext?.businessCriticality || "",
                    impactIfDown: appData.businessContext?.impactIfDown || "",
                    websiteUrl: appData.security?.websiteUrl || "",
                    loginUrl: appData.security?.loginUrl || "",
                    backupOwner: appData.security?.backupOwner || "",
                    ssoSupported: appData.security?.ssoSupported || "",
                    ssoEnabled: appData.security?.ssoEnabled || "",
                    mfaSupported: appData.security?.mfaSupported || "",
                    mfaEnabled: appData.security?.mfaEnabled || "",
                    dataClassification: appData.security?.dataClassification || "",
                    userCountBand: appData.userCountBand || "",
                    lastReviewedAt: appData.lastReviewedAt || "",
                    notes: appData.notes || "",
                    primaryUseCases: appData.primaryUseCases || "",
                    departmentsSupported: appData.departmentsSupported || "",
                    departmentIds: (appData.departments || []).map((d: { id: string }) => d.id),
                    accessRequestProcess: appData.accessRequestProcess || "",
                    trainingDocumentationUrl: appData.trainingDocumentationUrl || "",
                });
                setLoadingDepartments(false);
                setLoadingCapabilities(false);
                setLoadingApp(false);
            })
            .catch((err) => {
                setError(err.message || "Failed to load application");
                setLoadingDepartments(false);
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

    function handleDepartmentToggle(deptId: string) {
        setForm((prev) => {
            const current: string[] = prev.departmentIds || [];
            const next = current.includes(deptId)
                ? current.filter((id) => id !== deptId)
                : [...current, deptId];
            return { ...prev, departmentIds: next };
        });
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
                <h1>Edit System</h1>
                <Link to={`/applications/${applicationId}`} className="back-link">Back to System</Link>
            </header>

            {error && !loadingApp && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="create-form">
                <div className="form-section">
                    <h2 className="form-section-title">Core Details</h2>
                    <div className="form-grid">
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
                            <label htmlFor="systemCategory">System Category</label>
                            <select
                                id="systemCategory"
                                value={form.systemCategory}
                                onChange={(e) => handleChange("systemCategory", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select category</option>
                                {SYSTEM_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="architectureType">Architecture Type</label>
                            <select
                                id="architectureType"
                                value={form.architectureType}
                                onChange={(e) => handleChange("architectureType", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select architecture type</option>
                                {ARCHITECTURE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">Ownership</h2>
                    <div className="form-grid">
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
                            <label htmlFor="backupOwner">Backup Owner</label>
                            <input
                                id="backupOwner"
                                type="text"
                                value={form.backupOwner}
                                onChange={(e) => handleChange("backupOwner", e.target.value)}
                                placeholder="e.g., IT Manager"
                                disabled={submitting}
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">Business Context</h2>
                    <div className="form-grid">
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

                        <div className="form-field full-width">
                            <label htmlFor="impactIfDown">Impact If Down</label>
                            <textarea
                                id="impactIfDown"
                                value={form.impactIfDown}
                                onChange={(e) => handleChange("impactIfDown", e.target.value)}
                                rows={3}
                                disabled={submitting}
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">Operational Context</h2>
                    <div className="form-grid">
                        <div className="form-field">
                            <label htmlFor="mobileSupportType">Mobile Support
                                <span className="field-tooltip" title="Indicates whether the system has a mobile experience, such as native iOS/Android or mobile web.">ⓘ</span>
                            </label>
                            <select
                                id="mobileSupportType"
                                value={form.mobileSupportType}
                                onChange={(e) => handleChange("mobileSupportType", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                {MOBILE_SUPPORT_TYPES.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="apiAvailability">API Availability
                                <span className="field-tooltip" title="Indicates whether the system can exchange data programmatically through a vendor, internal, or limited API.">ⓘ</span>
                            </label>
                            <select
                                id="apiAvailability"
                                value={form.apiAvailability}
                                onChange={(e) => handleChange("apiAvailability", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                {API_AVAILABILITIES.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="reportingSource">Reporting Source</label>
                            <select
                                id="reportingSource"
                                value={form.reportingSource}
                                onChange={(e) => handleChange("reportingSource", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                {REPORTING_SOURCES.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field full-width">
                            <label htmlFor="primaryUseCases">Primary Use Cases</label>
                            <textarea
                                id="primaryUseCases"
                                value={form.primaryUseCases}
                                onChange={(e) => handleChange("primaryUseCases", e.target.value)}
                                placeholder="Describe the primary use cases for this application..."
                                rows={3}
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-field full-width">
                            <label htmlFor="departmentsSupported">
                                Department Usage Notes
                                <span className="field-tooltip" title="Free-text notes explaining how departments use the system, including role-specific context.">ⓘ</span>
                            </label>
                            <textarea
                                id="departmentsSupported"
                                value={form.departmentsSupported}
                                onChange={(e) => handleChange("departmentsSupported", e.target.value)}
                                placeholder="Describe how each department uses this system..."
                                rows={3}
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-field full-width">
                            <label>Departments Supported
                                <span className="field-tooltip" title="Structured list of departments that use or depend on this system. Used for filtering, reporting, ownership, and impact analysis.">ⓘ</span>
                            </label>
                            <div className="department-checkbox-group">
                                {loadingDepartments ? (
                                    <span className="field-hint">Loading departments...</span>
                                ) : departments.length === 0 ? (
                                    <span className="field-hint">No departments configured</span>
                                ) : (
                                    <div className="department-checkbox-grid">
                                        {departments.map((dept) => (
                                            <label key={dept.id} className="department-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={(form.departmentIds || []).includes(dept.id)}
                                                    onChange={() => handleDepartmentToggle(dept.id)}
                                                    disabled={submitting}
                                                />
                                                <span>{dept.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-field full-width">
                            <label htmlFor="accessRequestProcess">Access Request Process</label>
                            <textarea
                                id="accessRequestProcess"
                                value={form.accessRequestProcess}
                                onChange={(e) => handleChange("accessRequestProcess", e.target.value)}
                                placeholder="Describe how access requests are handled for this application..."
                                rows={3}
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="trainingDocumentationUrl">Training / Documentation URL</label>
                            <input
                                id="trainingDocumentationUrl"
                                type="url"
                                value={form.trainingDocumentationUrl}
                                onChange={(e) => handleChange("trainingDocumentationUrl", e.target.value)}
                                placeholder="https://..."
                                disabled={submitting}
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">Security & Access</h2>
                    <div className="form-grid">
                        <div className="form-field">
                            <label htmlFor="websiteUrl">Website URL</label>
                            <input
                                id="websiteUrl"
                                type="text"
                                value={form.websiteUrl}
                                onChange={(e) => handleChange("websiteUrl", e.target.value)}
                                placeholder="https://..."
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="loginUrl">Login URL</label>
                            <input
                                id="loginUrl"
                                type="text"
                                value={form.loginUrl}
                                onChange={(e) => handleChange("loginUrl", e.target.value)}
                                placeholder="https://..."
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="ssoSupported">SSO Supported</label>
                            <select
                                id="ssoSupported"
                                value={form.ssoSupported}
                                onChange={(e) => handleChange("ssoSupported", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="ssoEnabled">SSO Enabled</label>
                            <select
                                id="ssoEnabled"
                                value={form.ssoEnabled}
                                onChange={(e) => handleChange("ssoEnabled", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="mfaSupported">MFA Supported</label>
                            <select
                                id="mfaSupported"
                                value={form.mfaSupported}
                                onChange={(e) => handleChange("mfaSupported", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="mfaEnabled">MFA Enabled</label>
                            <select
                                id="mfaEnabled"
                                value={form.mfaEnabled}
                                onChange={(e) => handleChange("mfaEnabled", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="dataClassification">Data Classification</label>
                            <select
                                id="dataClassification"
                                value={form.dataClassification}
                                onChange={(e) => handleChange("dataClassification", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                <option value="Public">Public</option>
                                <option value="General">General</option>
                                <option value="Confidential">Confidential</option>
                                <option value="Restricted">Restricted</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="userCountBand">User Count</label>
                            <select
                                id="userCountBand"
                                value={form.userCountBand}
                                onChange={(e) => handleChange("userCountBand", e.target.value)}
                                disabled={submitting}
                            >
                                <option value="">Select</option>
                                <option value="1_10">1-10</option>
                                <option value="11_30">11-30</option>
                                <option value="31_60">31-60</option>
                                <option value="61_plus">61+</option>
                                <option value="Unknown">Unknown</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2 className="form-section-title">Review & Notes</h2>
                    <div className="form-grid">
                        <div className="form-field">
                            <label htmlFor="lastReviewedAt">Last Reviewed</label>
                            <input
                                id="lastReviewedAt"
                                type="date"
                                value={form.lastReviewedAt}
                                onChange={(e) => handleChange("lastReviewedAt", e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-field full-width">
                            <label htmlFor="notes">Notes</label>
                            <textarea
                                id="notes"
                                value={form.notes}
                                onChange={(e) => handleChange("notes", e.target.value)}
                                placeholder="Additional notes..."
                                rows={4}
                                maxLength={1000}
                                disabled={submitting}
                            />
                            <span className="field-hint">Max 1000 characters</span>
                        </div>
                    </div>
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
