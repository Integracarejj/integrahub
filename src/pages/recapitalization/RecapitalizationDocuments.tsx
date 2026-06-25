import { useState } from "react";
import { getDocuments, getTransactions } from "../../services/recapMockData";
import "./Recapitalization.css";

export default function RecapitalizationDocuments() {
    const documents = getDocuments();
    const transactions = getTransactions();
    const [selectedTxn, setSelectedTxn] = useState("all");

    const filtered = selectedTxn === "all"
        ? documents
        : documents.filter(d => d.transactionId === selectedTxn);

    return (
        <div className="rc-page">
            <div className="rc-header">
                <h1>Documents</h1>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Upload</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">New Folder</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">Link to Request</button>
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
                        <span style={{ color: "#94a3b8", fontSize: 14 }}>&#8981;</span>
                        <input placeholder="Search documents..." />
                    </div>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Open in SharePoint" style={{ fontSize: 16 }}>&#128279;</button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm rc-btn-icon" title="Upload" style={{ fontSize: 16 }}>&#11014;</button>
                </div>
                <div className="rc-mock-browser-body">
                    <div className="rc-mock-browser-tree">
                        <div className="rc-mock-tree-item rc-mock-tree-active">&#128193; All Files</div>
                        <div className="rc-mock-tree-item">&#128193; Financial Statements</div>
                        <div className="rc-mock-tree-item">&#128193; Licenses</div>
                        <div className="rc-mock-tree-item">&#128193; Environmental</div>
                        <div className="rc-mock-tree-item">&#128193; Insurance</div>
                        <div className="rc-mock-tree-item">&#128193; Legal</div>
                        <div className="rc-mock-tree-item">&#128193; HR / Staffing</div>
                        <div className="rc-mock-tree-item">&#128193; Regulatory</div>
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
                                            <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 12 }}>Open in SP</button>
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
