import { useState, useMemo } from "react";
import { getDocuments, getTransactions, isDemoActive } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

function toast(msg: string) { window.alert(msg); }

export default function RecapitalizationDocuments() {
    const documents = getDocuments();
    const transactions = getTransactions();
    const demo = isDemoActive();
    const [selectedTxn, setSelectedTxn] = useState("all");
    const [selectedCategory, setSelectedCategory] = useState("All");

    const categories = useMemo(() => {
        const set = new Set(documents.map(d => d.category));
        return ["All", ...Array.from(set).sort()];
    }, [documents]);

    const filtered = useMemo(() => {
        let result = documents;
        if (selectedTxn !== "all") result = result.filter(d => d.transactionId === selectedTxn);
        if (selectedCategory !== "All") result = result.filter(d => d.category === selectedCategory);
        return result;
    }, [documents, selectedTxn, selectedCategory]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        documents.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
        return counts;
    }, [documents]);

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <h1>Documents</h1>
                <div className="rc-header-actions">
                    {demo && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginRight: 6 }}>Live Demo Data</span>}
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => toast("Upload — coming next sprint")}>Upload</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => toast("New Folder — coming next sprint")}>New Folder</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => toast("Link to Request — coming next sprint")}>Link to Request</button>
                </div>
            </div>

            <div className="rc-placeholder-banner">
                <div className="rc-placeholder-banner-icon">&#128193;</div>
                <div>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--is-text-heading, #0f172a)", marginBottom: 4 }}>
                        Files will live in SharePoint
                    </span>
                    <span style={{ display: "block", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                        IntegraSource will show a SharePoint-backed document browser once Graph permissions are ready.
                        This mock browser shows the planned layout. Documents shown below are preview data only.
                    </span>
                </div>
            </div>

            <div className="rc-mock-browser">
                <div className="rc-mock-browser-toolbar">
                    <select className="rc-filter-select" value={selectedTxn} onChange={e => setSelectedTxn(e.target.value)}>
                        <option value="all">All Transactions</option>
                        {transactions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <div className="rc-search-box" style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: "#64748b", fontSize: 14 }}>&#8981;</span>
                        <input placeholder="Search documents..." />
                    </div>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Open in SharePoint" style={{ fontSize: 16 }} onClick={() => toast("Open in SharePoint — coming next sprint")}>&#128279;</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Upload" style={{ fontSize: 16 }} onClick={() => toast("Upload — coming next sprint")}>&#11014;</button>
                </div>
                <div className="rc-mock-browser-body">
                    <div className="rc-mock-browser-tree">
                        <div className={`rc-mock-tree-item ${selectedCategory === "All" ? "rc-mock-tree-active" : ""}`} onClick={() => setSelectedCategory("All")}>
                            &#128193; All Files <span style={{ color: "#94a3b8", marginLeft: 4, fontSize: 11 }}>({documents.length})</span>
                        </div>
                        {categories.filter(c => c !== "All").map(cat => (
                            <div key={cat} className={`rc-mock-tree-item ${selectedCategory === cat ? "rc-mock-tree-active" : ""}`} onClick={() => setSelectedCategory(cat)}>
                                &#128193; {cat} <span style={{ color: "#94a3b8", marginLeft: 4, fontSize: 11 }}>({categoryCounts[cat] || 0})</span>
                            </div>
                        ))}
                    </div>
                    <div className="rc-mock-browser-files">
                        <table className="rc-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Transaction</th>
                                    <th>Category</th>
                                    <th>Community</th>
                                    <th>Size</th>
                                    <th>Uploaded</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(doc => (
                                    <tr key={doc.id}>
                                        <td style={{ fontWeight: 500 }}>{doc.name}</td>
                                        <td className="rc-truncate">{doc.transactionName}</td>
                                        <td>{doc.category}</td>
                                        <td className="rc-truncate">{doc.communityNames.join(", ") || "All"}</td>
                                        <td style={{ fontSize: 12, color: "#64748b" }}>{doc.size}</td>
                                        <td style={{ fontSize: 12, color: "#64748b" }}>{doc.uploadedAt}</td>
                                        <td>
                                            <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 12 }} onClick={() => toast("Open in SharePoint — coming next sprint")}>Open in SP</button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={7}><div className="rc-empty-state">No documents found</div></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
