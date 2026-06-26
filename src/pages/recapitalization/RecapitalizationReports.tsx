import { useState } from "react";
import RecapSubNav from "./RecapSubNav";
import { isDemoActive, getDemoReports } from "../../services/recapDataService";
import "./Recapitalization.css";

function toast(msg: string) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;bottom:16px;right:16px;background:#1e293b;color:#fff;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)";
    el.textContent = msg;
    const ok = document.createElement("button");
    ok.textContent = "OK";
    ok.style.cssText = "background:none;border:none;color:#fff;margin-left:8px;font-size:11px;cursor:pointer";
    ok.onclick = () => el.remove();
    el.appendChild(ok);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

const REPORT_CARDS = [
    { title: "Completion by Transaction", value: "62%", desc: "Across all active transactions", detail: "Oakwood Portfolio: 8/12 complete (67%)\nLakeside Crossing: 5/8 complete (63%)\nValley View: 3/6 complete (50%)\nTotal: 16/26 requests provided (62%)", color: "#1d4ed8" },
    { title: "Requests by Category", value: "8", desc: "Most common: Financial Statements", detail: "Financial Statements: 8\nLicenses: 5\nEnvironmental: 4\nInsurance: 3\nLegal: 2\nOther categories: 4", color: "#4338ca" },
    { title: "Overdue by Owner", value: "3", desc: "Tom Davies has the most overdue items", detail: "Tom Davies: 2 overdue\nSarah Chen: 1 overdue\nOther owners: 0 overdue", color: "#991b1b" },
    { title: "Clarifications by Buyer", value: "5", desc: "Valstone Corp has 3 open clarifications", detail: "Valstone Corp: 3 open\nMarcus & Associates: 1 open\nPinnacle Properties: 1 open", color: "#92400e" },
    { title: "Avg Turnaround Time", value: "4.2d", desc: "From assignment to provided", detail: "Financial Statements: 3.1d\nLicenses: 2.8d\nEnvironmental: 6.4d\nInsurance: 5.0d\nLegal: 3.7d", color: "#166534" },
    { title: "Reused Deliverables", value: "12", desc: "Across all transactions this quarter", detail: "Phase I ESA: 4 reuses\nAudited Financials: 3 reuses\nInsurance Certificates: 3 reuses\nOperating Licenses: 2 reuses", color: "#4338ca" },
];

function buildDemoReportCards(): typeof REPORT_CARDS {
    const r = getDemoReports();
    return [
        {
            title: "Completion Rate",
            value: `${r.completion}%`,
            desc: `${r.readinessByCommunity.length} communities, ${r.readinessByCommunity.reduce((s, c) => s + c.total, 0)} total requests`,
            detail: r.readinessByCommunity.map(c => `${c.name}: ${c.provided}/${c.total} provided (${Math.round(c.provided / c.total * 100)}%)`).join("\n"),
            color: "#1d4ed8",
        },
        {
            title: "Open by Category",
            value: `${r.openByCategory[0]?.count || 0}`,
            desc: `Most open: ${r.openByCategory[0]?.name || "N/A"}`,
            detail: r.openByCategory.map(c => `${c.name}: ${c.count} open`).join("\n"),
            color: "#4338ca",
        },
        {
            title: "Overdue Requests",
            value: `${r.overdue}`,
            desc: "Items past their due date",
            detail: `${r.overdue} overdue items across all teams\n${r.needsFollowUp} items need follow-up`,
            color: "#991b1b",
        },
        {
            title: "Open by Team",
            value: `${r.openByTeam.reduce((s, t) => s + t.count, 0)}`,
            desc: `Most load: ${r.openByTeam[0]?.name || "N/A"}`,
            detail: r.openByTeam.map(t => `${t.name}: ${t.count} open`).join("\n"),
            color: "#92400e",
        },
        {
            title: "Possible Duplicates",
            value: `${r.duplicates}`,
            desc: "Items flagged by classification engine",
            detail: `${r.duplicates} items marked as possible duplicates\nReview recommended before publishing`,
            color: "#92400e",
        },
        {
            title: "Needs Follow-Up",
            value: `${r.needsFollowUp}`,
            desc: "Clarifications pending response",
            detail: `${r.needsFollowUp} items awaiting clarification\nAcross ${r.openByTeam.length} teams`,
            color: "#4338ca",
        },
    ];
}

export default function RecapitalizationReports() {
    const demo = isDemoActive();
    const cards = demo ? buildDemoReportCards() : REPORT_CARDS;
    const [selectedReport, setSelectedReport] = useState<typeof REPORT_CARDS[number] | null>(null);

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <h1>Reports</h1>
                <div className="rc-header-actions">
                    {demo && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginRight: 6 }}>Live Demo Data</span>}
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => toast("Export All — coming next sprint")}>Export All</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => toast("Schedule — coming next sprint")}>Schedule</button>
                </div>
            </div>

            <div className="rc-placeholder-banner">
                <div className="rc-placeholder-banner-icon">&#128202;</div>
                <div>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--is-text-heading, #0f172a)", marginBottom: 4 }}>
                        Reports Dashboard {demo ? "(Live)" : "(Preview)"}
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        {demo
                            ? "Reports computed live from ABC Company Portfolio demo data across 300 requests and 5 communities."
                            : "Reporting will be powered by real data once the tracker is live. These cards show the planned metrics."}
                    </span>
                </div>
            </div>

            <div className="rc-three-col">
                {cards.map(card => (
                    <div key={card.title} className="rc-mock-report-card" style={{ borderTop: `3px solid ${card.color}`, cursor: "pointer" }} onClick={() => setSelectedReport(card)}>
                        <div className="rc-mock-report-value">{card.value}</div>
                        <div className="rc-mock-report-title">{card.title}</div>
                        <div className="rc-mock-report-desc">{card.desc}</div>
                    </div>
                ))}
            </div>

            {selectedReport && (
                <div className="rc-modal-overlay" onClick={() => setSelectedReport(null)}>
                    <div className="rc-modal rc-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="rc-modal-header">
                            <h2>{selectedReport.title}</h2>
                            <button className="rc-modal-close" onClick={() => setSelectedReport(null)}>&times;</button>
                        </div>
                        <div className="rc-detail-modal-body">
                            <div className="rc-detail-modal-value" style={{ color: selectedReport.color }}>{selectedReport.value}</div>
                            <div className="rc-detail-modal-title">{selectedReport.title}</div>
                            <div className="rc-detail-modal-desc">{selectedReport.desc}</div>
                            <div style={{ textAlign: "left", borderTop: "1px solid #e2e8f0", paddingTop: 14, marginTop: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 8 }}>Detail</span>
                                {selectedReport.detail.split("\n").map((line, i) => (
                                    <div key={i} style={{ fontSize: 13, color: "#334155", padding: "3px 0", borderBottom: i < selectedReport.detail.split("\n").length - 1 ? "1px solid #f1f5f9" : "none" }}>{line}</div>
                                ))}
                            </div>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => toast("Export Report — coming next sprint")}>Export</button>
                            <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => setSelectedReport(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
