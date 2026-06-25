import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

const REPORT_CARDS = [
    { title: "Completion by Transaction", value: "62%", desc: "Across all active transactions", color: "#1d4ed8" },
    { title: "Requests by Category", value: "8", desc: "Most common: Financial Statements", color: "#4338ca" },
    { title: "Overdue by Owner", value: "3", desc: "Tom Davies has the most overdue items", color: "#991b1b" },
    { title: "Clarifications by Buyer", value: "5", desc: "Valstone Corp has 3 open clarifications", color: "#92400e" },
    { title: "Avg Turnaround Time", value: "4.2d", desc: "From assignment to provided", color: "#166534" },
    { title: "Reused Deliverables", value: "12", desc: "Across all transactions this quarter", color: "#4338ca" },
];

export default function RecapitalizationReports() {
    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <h1>Reports</h1>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Export All</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Schedule</button>
                </div>
            </div>

            <div className="rc-placeholder-banner">
                <div className="rc-placeholder-banner-icon">&#128202;</div>
                <div>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--is-text-heading, #0f172a)", marginBottom: 4 }}>
                        Reports Dashboard (Preview)
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        Reporting will be powered by real data once the tracker is live. These cards show the planned metrics.
                    </span>
                </div>
            </div>

            <div className="rc-three-col">
                {REPORT_CARDS.map(card => (
                    <div key={card.title} className="rc-mock-report-card" style={{ borderTop: `3px solid ${card.color}` }}>
                        <div className="rc-mock-report-value">{card.value}</div>
                        <div className="rc-mock-report-title">{card.title}</div>
                        <div className="rc-mock-report-desc">{card.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
