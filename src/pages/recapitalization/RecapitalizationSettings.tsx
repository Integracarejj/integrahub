import "./Recapitalization.css";

const SETTING_GROUPS = [
    {
        title: "Categories",
        items: [
            { name: "Financial Statements", desc: "Audited financials, P&L, balance sheets", value: "Active" },
            { name: "Licenses", desc: "State licenses, certifications, survey results", value: "Active" },
            { name: "Environmental", desc: "Phase I/II reports, environmental assessments", value: "Active" },
            { name: "Insurance", desc: "Liability, workers comp, property insurance", value: "Active" },
            { name: "Legal", desc: "Litigation summary, contracts, regulatory", value: "Active" },
            { name: "HR / Staffing", desc: "Staffing rosters, wage reports, turnover", value: "Active" },
        ],
    },
    {
        title: "Teams",
        items: [
            { name: "Financial Analysis", desc: "6 members — Sarah Chen, Mike O'Brien, Carlos Rivera", value: "Active" },
            { name: "Regulatory", desc: "2 members — James Wright", value: "Active" },
            { name: "Environmental", desc: "2 members — Lisa Park", value: "Active" },
            { name: "Risk Management", desc: "2 members — Tom Davies", value: "Active" },
            { name: "HR & Operations", desc: "2 members — Anna Patel", value: "Active" },
        ],
    },
    {
        title: "Configuration",
        items: [
            { name: "Assignment Rules", desc: "Auto-assign based on category and team load", value: "Enabled" },
            { name: "External Visibility Default", desc: "Default setting for new requests", value: "Visible" },
            { name: "SharePoint Site Mapping", desc: "Recapitalization Hub site for document storage", value: "Not configured" },
            { name: "Notification Rules", desc: "Email and in-app notification triggers", value: "Basic" },
            { name: "Status Workflow", desc: "Allowed status transitions and required fields", value: "Standard" },
        ],
    },
];

export default function RecapitalizationSettings() {
    return (
        <div className="rc-page">
            <div className="rc-header">
                <h1>Settings</h1>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-primary rc-btn-sm">Save Changes</button>
                </div>
            </div>

            {SETTING_GROUPS.map(group => (
                <div key={group.title} className="rc-card">
                    <div className="rc-card-header">
                        <h2>{group.title}</h2>
                        <button className="rc-btn rc-btn-ghost rc-btn-sm">Manage</button>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {group.items.map(item => (
                            <div key={item.name} className="rc-setting-card">
                                <div className="rc-setting-info">
                                    <span className="rc-setting-name">{item.name}</span>
                                    <span className="rc-setting-desc">{item.desc}</span>
                                </div>
                                <span className="rc-setting-value">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="rc-placeholder-banner">
                <div className="rc-placeholder-banner-icon">&#9881;</div>
                <div>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--is-text-heading, #0f172a)", marginBottom: 4 }}>
                        Configuration is mock-only for Phase 1
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        Settings pages and configuration values shown here are placeholder previews. Actual configuration will use database-backed storage once the tracker schema is deployed.
                    </span>
                </div>
            </div>
        </div>
    );
}
