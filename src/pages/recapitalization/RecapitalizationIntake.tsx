import { useState, useMemo } from "react";
import { useNavigate, useParams, Routes, Route } from "react-router-dom";
import { getIntakeItems, isDemoActive, getDemoEngineSummary, publishIntake, publishSelectedRequests, getDemoRequests, getRequests, bulkUpdateDemoRequests, getTeamMembers, getTeams } from "../../services/recapDataService";
import type { RecapIntakeItem, RecapRequest, RecapTeamMember } from "../../services/recapDataService";
import RecapSubNav from "./RecapSubNav";
import "./Recapitalization.css";

interface Note {
    id: string;
    author: string;
    timestamp: string;
    body: string;
}

const DEFAULT_NOTES: Note[] = [
    { id: "n1", author: "David Park", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), body: "Assigned to Sarah Chen for initial review" },
    { id: "n2", author: "Sarah Chen", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), body: "Follow up with broker on file format" },
];

const SOURCE_CONFIG: Record<string, { icon: string; label: string; cssClass: string }> = {
    "Broker Upload": { icon: "\u{1F4E4}", label: "Broker Upload", cssClass: "rc-badge-import" },
    "External Question": { icon: "\u2753", label: "Question", cssClass: "rc-badge-external-question" },
    "External Clarification": { icon: "\u2757", label: "Clarification", cssClass: "rc-badge-external-clarification" },
    "External New Request": { icon: "\u2795", label: "New Request", cssClass: "rc-badge-external-request" },
    "Access Request": { icon: "\u{1F512}", label: "Access Request", cssClass: "rc-badge-access" },
    "Manual Internal Request": { icon: "\u{1F4CB}", label: "Internal Request", cssClass: "rc-badge-internal" },
};

const STATUS_BADGE: Record<string, string> = {
    "Awaiting Review": "rc-badge-intake-awaiting",
    "Assigned": "rc-badge-intake-assigned",
    "Converted": "rc-badge-intake-converted",
    "Duplicate": "rc-badge-intake-duplicate",
    "Rejected": "rc-badge-intake-rejected",
    "Not Applicable": "rc-badge-intake-na",
};

const PRIORITY_BADGE: Record<string, string> = {
    High: "rc-badge-high",
    Medium: "rc-badge-medium",
    Low: "rc-badge-low",
};

const CARD_FILTER_MAP: Record<string, string | null> = {
    newRequests: "External New Request",
    questions: "External Question",
    clarifications: "External Clarification",
    accessRequests: "Access Request",
    brokerUploads: "Broker Upload",
    needsAssignment: "__needs_assignment__",
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (name: string) => void }) {
    const [fileName, setFileName] = useState("");
    const [importing, setImporting] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            setFileName(file.name);
            setImporting(true);
            setTimeout(() => {
                setImporting(false);
                onImport(file.name);
            }, 1200);
        }
    };

    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="rc-modal-header">
                    <h2>Import DD Package</h2>
                    <button className="rc-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
                    {importing ? (
                        <div>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Processing {fileName}...</p>
                            <p style={{ fontSize: 12, color: "#64748b" }}>Running classification engine...</p>
                            <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
                                <div style={{ width: "70%", height: "100%", background: "#4f46e5", borderRadius: 3, animation: "none" }} />
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: "32px 20px", cursor: "pointer", transition: "border-color 0.2s" }}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#4f46e5"; }}
                            onDragLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; }}
                            onDrop={handleDrop}
                            onClick={() => {
                                setFileName("ABC_Company_Portfolio_Gold_Standard_DD_Package.xlsx");
                                setImporting(true);
                                setTimeout(() => { setImporting(false); onImport("ABC_Company_Portfolio_Gold_Standard_DD_Package.xlsx"); }, 1200);
                            }}
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0 }}>Drop your DD package here</p>
                            <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>or click to browse (mock import)</p>
                        </div>
                    )}
                </div>
                <div className="rc-modal-footer">
                    <button className="rc-btn rc-btn-ghost" onClick={onClose} disabled={importing}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

function hashId(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) { h = ((h << 5) - h) + id.charCodeAt(i); h |= 0; }
    return Math.abs(h);
}

const CATEGORIES_LIST = ["Financial Statements", "Licenses", "Environmental", "Insurance", "Legal", "HR / Staffing", "Physical Plant", "Regulatory", "Operations", "Marketing"];
const TEAMS_LIST = ["Financial Analysis", "Regulatory", "Environmental", "Risk Management", "HR & Operations", "DD Management"];
const PRIORITIES_LIST: RecapRequest["priority"][] = ["High", "Medium", "Low"];
const PAGE_SIZE = 50;

const REVIEW_STATE_KEY = "integrasource.recap.demo.reviewStates";

type ReviewState = "Ready to Publish" | "Pending Review" | "Clarification Needed" | "Archived";

function ReviewEngine() {
    const navigate = useNavigate();
    const { intakeId } = useParams<{ intakeId: string }>();
    const [published, setPublished] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishAll, setPublishAll] = useState(false);

    const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [communityFilter, setCommunityFilter] = useState("All");
    const [teamFilter, setTeamFilter] = useState("All");
    const [priorityFilter, setPriorityFilter] = useState("All");
    const [reviewStateFilter, setReviewStateFilter] = useState("All");
    const [page, setPage] = useState(0);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [detailItem, setDetailItem] = useState<RecapRequest | null>(null);
    const [updateCount, setUpdateCount] = useState(0);
    const [toastMsg, setToastMsg] = useState("");
    const [bulkReviewState, setBulkReviewState] = useState("");
    const [bulkTeam, setBulkTeam] = useState("");
    const [bulkCategory, setBulkCategory] = useState("");
    const [bulkPriority, setBulkPriority] = useState("");

    // If intakeId provided, look up the intake item and scope to its transaction
    const scope = useMemo(() => {
        if (!intakeId) return null;
        const allIntakes = getIntakeItems();
        return allIntakes.find(i => i.intakeId === intakeId || i.id === intakeId) || null;
    }, [intakeId]);

    const [userReviewStates, setUserReviewStates] = useState<Record<string, ReviewState>>(() => {
        try {
            const raw = localStorage.getItem(REVIEW_STATE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    });

    const persistReviewState = (id: string, state: ReviewState) => {
        const next = { ...userReviewStates, [id]: state };
        localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(next));
        setUserReviewStates(next);
    };

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 2500);
    };

    const summary = getDemoEngineSummary();
    const allDemoRequests = getDemoRequests();
    const allRequests = useMemo(() => {
        if (scope) {
            // Filter by the intake's transactionId
            const merged = getRequests();
            return merged.filter(r => r.transactionId === scope.transactionId);
        }
        return allDemoRequests;
    }, [updateCount, scope, allDemoRequests]);

    const computedSummary = useMemo(() => {
        if (!scope) return summary;
        const cats: Record<string, number> = {};
        const teams: Record<string, number> = {};
        allRequests.forEach(r => {
            cats[r.category] = (cats[r.category] || 0) + 1;
            teams[r.team] = (teams[r.team] || 0) + 1;
        });
        return {
            total: allRequests.length,
            needsReview: allRequests.filter(r => r.status === "Open" || !r.category).length,
            possibleDuplicates: 0,
            needsFollowUp: allRequests.filter(r => r.status === "Clarification Needed").length,
            critical: allRequests.filter(r => r.priority === "High" && (r.status === "Open" || r.status === "Overdue")).length,
            categories: cats,
            teams,
        };
    }, [scope, summary, allRequests]);

    const duplicateInfo = useMemo(() => {
        const withinPkg = new Set<string>();
        const possibleMatch = new Set<string>();
        const existingReq = new Set<string>();
        allRequests.forEach(r => {
            const mod = hashId(r.id) % 25;
            if (mod === 0) withinPkg.add(r.id);
            else if (mod === 2) possibleMatch.add(r.id);
        });
        return { withinPkg, possibleMatch, existingReq };
    }, [allRequests]);

    const getDupType = (id: string): string => {
        if (duplicateInfo.existingReq.has(id)) return "Existing Request";
        if (duplicateInfo.withinPkg.has(id)) return "Within Package";
        if (duplicateInfo.possibleMatch.has(id)) return "Possible Match";
        return "None";
    };

    const DUP_TOOLTIP: Record<string, string> = {
        "Within Package": "Another request inside THIS uploaded package appears to request the same deliverable.",
        "Possible Match": "A similar request exists elsewhere and should be reviewed before creating another deliverable.",
        "Existing Request": "This request matches a previously published request in the tracker.",
    };

    const getReviewState = (r: RecapRequest, _dupType: string): ReviewState => {
        if (userReviewStates[r.id]) return userReviewStates[r.id];
        if (r.status === "Clarification Needed") return "Clarification Needed";
        if (!r.category || !r.category.trim() || !r.team || !r.team.trim() || !r.communityNames.length || r.status === "Open") return "Pending Review";
        return "Pending Review";
    };

    const enriched = useMemo(() => {
        return allRequests.map(r => {
            const dupType = getDupType(r.id);
            const reviewState = getReviewState(r, dupType);
            const potentialDuplicate = dupType !== "None";
            const aiAct = r.status === "Open" ? "Pending Review" : r.status === "Clarification Needed" ? "Clarification Needed" : r.status === "Overdue" ? "Overdue" : r.status === "Provided" ? "Provided" : r.status === "Under Review" ? "Under Review" : "In Progress";
            const deliverable = r.title.split(" - ")[0];
            return { ...r, _duplicateType: dupType, _potentialDuplicate: potentialDuplicate, _reviewState: reviewState, _aiAction: aiAct, _deliverable: deliverable, _activityCount: Math.floor(hashId(r.id) % 7) };
        });
    }, [allRequests, userReviewStates]);

    const communities = useMemo(() => {
        const s = new Set<string>();
        allRequests.forEach(r => r.communityNames.forEach(c => s.add(c)));
        return [...s].sort();
    }, [allRequests]);

    const reviewStateCounts = useMemo(() => {
        const counts: Record<string, number> = { "Ready to Publish": 0, "Pending Review": 0, "Clarification Needed": 0, "Archived": 0 };
        enriched.forEach(r => { counts[r._reviewState] = (counts[r._reviewState] || 0) + 1; });
        return counts;
    }, [enriched]);

    const criticalCount = useMemo(() => enriched.filter(r => r.priority === "High" && (r.status === "Open" || r.status === "Overdue")).length, [enriched]);

    const filtered = useMemo(() => {
        let result = enriched;
        if (activeCardFilter === "ready") result = result.filter(r => r._reviewState === "Ready to Publish");
        else if (activeCardFilter === "pending") result = result.filter(r => r._reviewState === "Pending Review");
        else if (activeCardFilter === "archived") result = result.filter(r => r._reviewState === "Archived");
        else if (activeCardFilter === "clarification") result = result.filter(r => r._reviewState === "Clarification Needed");
        else if (activeCardFilter === "critical") result = result.filter(r => r.priority === "High" && (r.status === "Open" || r.status === "Overdue"));
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.communityNames.some(c => c.toLowerCase().includes(q)) || r.team.toLowerCase().includes(q) || r._deliverable.toLowerCase().includes(q));
        }
        if (categoryFilter !== "All") result = result.filter(r => r.category === categoryFilter);
        if (communityFilter !== "All") result = result.filter(r => r.communityNames.includes(communityFilter));
        if (teamFilter !== "All") result = result.filter(r => r.team === teamFilter);
        if (priorityFilter !== "All") result = result.filter(r => r.priority === priorityFilter);
        if (reviewStateFilter !== "All") result = result.filter(r => r._reviewState === reviewStateFilter);
        return result;
    }, [enriched, activeCardFilter, searchQuery, categoryFilter, communityFilter, teamFilter, priorityFilter, reviewStateFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    const rangeStart = safePage * PAGE_SIZE + 1;
    const rangeEnd = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

    const doEdit = (id: string, patch: Partial<RecapRequest>) => {
        bulkUpdateDemoRequests([id], patch);
        setUpdateCount(k => k + 1);
        showToast("Saved locally");
    };

    const handleCardFilter = (key: string | null) => {
        setActiveCardFilter(prev => prev === key ? null : key);
        setPage(0);
        setSelectedIds(new Set());
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };

    const toggleSelectAll = () => {
        if (paginated.length > 0 && paginated.every(r => selectedIds.has(r.id))) setSelectedIds(new Set());
        else setSelectedIds(new Set(paginated.map(r => r.id)));
    };

    const handlePublishReady = () => {
        const ids = enriched.filter(r => r._reviewState === "Ready to Publish").map(r => r.id);
        if (ids.length === 0) return;
        setPublishing(true);
        setTimeout(() => {
            publishSelectedRequests(ids);
            setPublishing(false);
            setPublished(true);
        }, 1500);
    };

    const handlePublishAll = () => {
        setPublishAll(true);
        setPublishing(true);
        setTimeout(() => {
            publishIntake();
            setPublishing(false);
            setPublished(true);
        }, 1500);
    };

    const handleBulkApply = () => {
        if (selectedIds.size === 0) return;
        let applied = false;
        if (bulkReviewState) {
            const next = { ...userReviewStates };
            [...selectedIds].forEach(id => { next[id] = bulkReviewState as ReviewState; });
            localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(next));
            setUserReviewStates(next);
            applied = true;
        }
        const patch: Partial<RecapRequest> = {};
        if (bulkTeam) patch.team = bulkTeam;
        if (bulkCategory) patch.category = bulkCategory;
        if (bulkPriority) patch.priority = bulkPriority as RecapRequest["priority"];
        if (Object.keys(patch).length > 0) {
            bulkUpdateDemoRequests([...selectedIds], patch);
            setUpdateCount(k => k + 1);
            applied = true;
        }
        if (applied) {
            showToast(`Applied to ${selectedIds.size} items`);
            setBulkReviewState("");
            setBulkTeam("");
            setBulkCategory("");
            setBulkPriority("");
        }
    };

    const handleBulkPublishSelected = () => {
        if (selectedIds.size === 0) return;
        const bulkReady = [...selectedIds].filter(id => {
            const r = enriched.find(e => e.id === id);
            return r && r._reviewState === "Ready to Publish";
        });
        if (bulkReady.length === 0) {
            showToast("No selected items are marked 'Ready to Publish'");
            return;
        }
        publishSelectedRequests(bulkReady);
        setUpdateCount(k => k + 1);
        showToast(`Published ${bulkReady.length} selected request${bulkReady.length !== 1 ? "s" : ""}`);
    };

    const CARD_STYLE = (borderColor: string, isActive: boolean) => ({
        borderLeft: `3px solid ${borderColor}`,
        cursor: "pointer",
        opacity: isActive ? 1 : 0.7,
        transition: "opacity 0.15s",
        background: isActive ? "#f8faff" : undefined,
    } as React.CSSProperties);

    const SELECT_STYLE = { fontSize: 11, padding: "2px 20px 2px 6px", border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#111827", minWidth: 90 };

    const REVIEW_STATE_COLORS: Record<ReviewState, string> = {
        "Ready to Publish": "#166534",
        "Pending Review": "#1d4ed8",
        "Clarification Needed": "#92400e",
        "Archived": "#64748b",
    };

    const activeSummary = scope ? computedSummary : summary;
    const readyCount = reviewStateCounts["Ready to Publish"];

    if (published) {
        const count = publishAll ? activeSummary.total : readyCount;
        return (
            <div className="rc-page">
                <div className="rc-header">
                    <div className="rc-header-left">
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/intake")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12" />
                                <polyline points="12 19 5 12 12 5" />
                            </svg>
                            Back to Intake
                        </button>
                    </div>
                </div>
                <div className="iq-review-placeholder">
                    <div className="iq-review-placeholder-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <h2>Published to Tracker!</h2>
                    <p>{count} DD requests are now available in the Request Tracker.</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <button className="rc-btn rc-btn-primary" onClick={() => navigate("/recapitalization/tracker")}>Open Tracker</button>
                        <button className="rc-btn rc-btn-secondary" onClick={() => navigate("/recapitalization/intake")}>Return to Intake Queue</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rc-page">
            <RecapSubNav />
            <div className="rc-header">
                <div className="rc-header-left">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => navigate("/recapitalization/intake")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Intake
                    </button>
                    <h1>Intake Workbench</h1>
                    {scope && (
                        <span className="rc-badge rc-badge-import" style={{ fontSize: 10, marginLeft: 8 }}>{scope.transactionName}</span>
                    )}
                </div>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setUpdateCount(k => k + 1); showToast("Refreshed"); }}>Refresh</button>
                    <button className="rc-btn rc-btn-primary" onClick={handlePublishReady} disabled={publishing || readyCount === 0} title={readyCount === 0 ? "No items are ready to publish" : ""}>
                        {publishing ? "Publishing..." : `Publish Ready Requests (${readyCount})`}
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={handlePublishAll} disabled={publishing}>
                        Publish All Demo Requests
                    </button>
                </div>
            </div>

            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                Review the AI-classified package, correct routing, resolve warnings, and publish ready requests to the tracker.
            </p>

            {publishing && (
                <div style={{ padding: "8px 0", fontSize: 12, color: "#4f46e5", fontWeight: 600 }}>
                    Converting intake items to official DD requests...
                </div>
            )}

            <div className="rc-stats-row">
                <div className="rc-stat-card" style={CARD_STYLE("#4338ca", activeCardFilter === null)} onClick={() => handleCardFilter(null)}>
                    <span className="rc-stat-value">{activeSummary.total}</span>
                    <span className="rc-stat-label">Total Items</span>
                </div>
                <div className="rc-stat-card" style={CARD_STYLE("#166534", activeCardFilter === "ready")} onClick={() => handleCardFilter("ready")}>
                    <span className="rc-stat-value">{reviewStateCounts["Ready to Publish"]}</span>
                    <span className="rc-stat-label">Ready to Publish</span>
                    <span className="rc-stat-desc">Cleared for tracker</span>
                </div>
                <div className="rc-stat-card" style={CARD_STYLE("#1d4ed8", activeCardFilter === "pending")} onClick={() => handleCardFilter("pending")}>
                    <span className="rc-stat-value">{reviewStateCounts["Pending Review"]}</span>
                    <span className="rc-stat-label">Pending Review</span>
                    <span className="rc-stat-desc">Missing info or classification</span>
                </div>
                <div className="rc-stat-card" style={CARD_STYLE("#92400e", activeCardFilter === "clarification")} onClick={() => handleCardFilter("clarification")}>
                    <span className="rc-stat-value">{reviewStateCounts["Clarification Needed"]}</span>
                    <span className="rc-stat-label">Clarification Needed</span>
                    <span className="rc-stat-desc">Follow-up recommended</span>
                </div>
                <div className="rc-stat-card" style={CARD_STYLE("#64748b", activeCardFilter === "archived")} onClick={() => handleCardFilter("archived")}>
                    <span className="rc-stat-value">{reviewStateCounts["Archived"]}</span>
                    <span className="rc-stat-label">Archived</span>
                    <span className="rc-stat-desc">Duplicates &amp; N/A items</span>
                </div>
                <div className="rc-stat-card" style={CARD_STYLE("#991b1b", activeCardFilter === "critical")} onClick={() => handleCardFilter("critical")}>
                    <span className="rc-stat-value">{criticalCount}</span>
                    <span className="rc-stat-label">Critical</span>
                    <span className="rc-stat-desc">High priority, open/overdue</span>
                </div>
            </div>

            <div className="rc-two-col">
                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Classification by Category</h2>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(activeSummary.categories).map(([cat, count]) => (
                            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: "#475569", flexShrink: 0 }}>{cat}</span>
                                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(count / activeSummary.total) * 100}%`, background: "#4338ca", borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", minWidth: 30, textAlign: "right" }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>Suggested Team Routing</h2>
                    </div>
                    <div className="rc-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(activeSummary.teams).map(([team, count]) => (
                            <div key={team} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 140, fontSize: 12, fontWeight: 600, color: "#475569", flexShrink: 0 }}>{team}</span>
                                <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(count / activeSummary.total) * 100}%`, background: "#1d4ed8", borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", minWidth: 30, textAlign: "right" }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rc-card" style={{ marginBottom: 16 }}>
                <div className="rc-card-header">
                    <h2>Engine Warnings</h2>
                </div>
                <div className="rc-card-body" style={{ padding: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>&#9888;</span>
                            <div>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#92400e" }}>{enriched.filter(r => r._potentialDuplicate).length} item{enriched.filter(r => r._potentialDuplicate).length !== 1 ? "s" : ""} flagged as potential duplicates</span>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Within-package duplicates or possible matches detected. Archive items that are confirmed duplicates.</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>&#9888;</span>
                            <div>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#92400e" }}>{reviewStateCounts["Clarification Needed"]} item{reviewStateCounts["Clarification Needed"] !== 1 ? "s" : ""} need{reviewStateCounts["Clarification Needed"] === 1 ? "s" : ""} clarification</span>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Some requests have incomplete or ambiguous descriptions. Clarify before publishing.</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>&#128200;</span>
                            <div>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>{Object.keys(activeSummary.categories).length} categories detected</span>
                                <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Classification engine assigned categories and teams. Review routing suggestions below.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rc-card">
                <div className="rc-card-header">
                    <h2>
                        Review Items
                        <span className="rc-text-muted" style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                            {filtered.length} items
                        </span>
                        {activeCardFilter && (
                            <button className="rc-clear-filter" onClick={() => setActiveCardFilter(null)} style={{ marginLeft: 8 }}>
                                Clear filter
                            </button>
                        )}
                    </h2>
                    <div className="rc-flex-center" style={{ gap: 8, flexWrap: "wrap" }}>
                        <div className="iq-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <select className="rc-filter-select" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }} style={{ minWidth: 120 }}>
                            <option value="All">All Categories</option>
                            {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="rc-filter-select" value={communityFilter} onChange={e => { setCommunityFilter(e.target.value); setPage(0); }} style={{ minWidth: 120 }}>
                            <option value="All">All Communities</option>
                            {communities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="rc-filter-select" value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setPage(0); }} style={{ minWidth: 120 }}>
                            <option value="All">All Teams</option>
                            {TEAMS_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select className="rc-filter-select" value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(0); }} style={{ minWidth: 100 }}>
                            <option value="All">All Priorities</option>
                            {PRIORITIES_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select className="rc-filter-select" value={reviewStateFilter} onChange={e => { setReviewStateFilter(e.target.value); setPage(0); }} style={{ minWidth: 130 }}>
                            <option value="All">All Items</option>
                            <option value="Ready to Publish">Ready to Publish</option>
                            <option value="Pending Review">Pending Review</option>
                            <option value="Clarification Needed">Clarification Needed</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                </div>

                {selectedIds.size > 0 && (
                    <div style={{ padding: "8px 12px", margin: "4px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", border: "1px solid #4338ca", background: "#eef2ff", borderRadius: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: "#4338ca", whiteSpace: "nowrap" }}>
                            <span className="rc-bulk-count">{selectedIds.size}</span> selected
                        </span>
                        <div className="rc-bulk-sep" />
                        <select value={bulkReviewState} onChange={e => setBulkReviewState(e.target.value)} style={{ fontSize: 11, padding: "3px 20px 3px 6px", border: "1px solid #c7d2fe", borderRadius: 4, minWidth: 130 }}>
                            <option value="">Review State...</option>
                            <option value="Ready to Publish">Ready to Publish</option>
                            <option value="Pending Review">Pending Review</option>
                            <option value="Clarification Needed">Clarification Needed</option>
                            <option value="Archived">Archived</option>
                        </select>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }} onClick={() => { if (selectedIds.size === 0) return; const next = { ...userReviewStates }; [...selectedIds].forEach(id => { next[id] = "Archived" as ReviewState; }); localStorage.setItem(REVIEW_STATE_KEY, JSON.stringify(next)); setUserReviewStates(next); showToast(`Archived ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}`); }}>
                            Archive as Duplicate
                        </button>
                        <select value={bulkTeam} onChange={e => setBulkTeam(e.target.value)} style={{ fontSize: 11, padding: "3px 20px 3px 6px", border: "1px solid #c7d2fe", borderRadius: 4, minWidth: 120 }}>
                            <option value="">Assign Team...</option>
                            {TEAMS_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} style={{ fontSize: 11, padding: "3px 20px 3px 6px", border: "1px solid #c7d2fe", borderRadius: 4, minWidth: 120 }}>
                            <option value="">Change Category...</option>
                            {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={bulkPriority} onChange={e => setBulkPriority(e.target.value)} style={{ fontSize: 11, padding: "3px 20px 3px 6px", border: "1px solid #c7d2fe", borderRadius: 4, minWidth: 90 }}>
                            <option value="">Change Priority...</option>
                            {PRIORITIES_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={handleBulkApply} style={{ fontSize: 11, padding: "4px 12px" }}>
                            Apply Bulk Updates
                        </button>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ fontSize: 12, color: "#166534", fontWeight: 600 }} onClick={handleBulkPublishSelected}>
                            Publish Selected
                        </button>
                        <div className="rc-bulk-sep" />
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setSelectedIds(new Set())}>Clear Selection</button>
                    </div>
                )}

                <div className="rc-card-body" style={{ padding: 0 }}>
                    <div style={{ display: "flex", gap: 16, padding: "8px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                        <span><span style={{ color: "#d97706", fontWeight: 700 }}>&#9888;</span> Warning icon = potential duplicate detected</span>
                        <span>"Archive as Duplicate" moves items to <span style={{ fontWeight: 600 }}>Archived</span> state</span>
                        <span>Empty values show <span style={{ color: "#94a3b8" }}>&mdash;</span></span>
                        <span>Click a row or <span style={{ color: "#4338ca" }}>View</span> to open the detail drawer</span>
                    </div>

                    {filtered.length > 0 ? (
                        <>
                            <div style={{ maxHeight: 520, overflowY: "auto", overflowX: "auto", position: "relative" }}>
                                <table className="rc-table review-grid" style={{ minWidth: 1400, fontSize: 12 }}>
                                    <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "#f8fafc" }}>
                                        <tr>
                                            <th className="review-sticky-col review-sticky-check" style={{ width: 20, paddingRight: 4 }}>
                                                <input type="checkbox" className="rc-checkbox-header" checked={paginated.length > 0 && paginated.every(r => selectedIds.has(r.id))} onChange={toggleSelectAll} />
                                            </th>
                                            <th className="review-sticky-col review-sticky-id" style={{ minWidth: 100 }}>Intake ID</th>
                                            <th className="review-sticky-col review-sticky-title" style={{ minWidth: 200 }}>Request Title</th>
                                            <th style={{ minWidth: 100 }}>Community</th>
                                            <th style={{ minWidth: 130 }}>Category</th>
                                            <th style={{ minWidth: 140 }}>Suggested Team</th>
                                            <th style={{ width: 80 }}>Priority</th>
                                            <th style={{ minWidth: 100 }}>Status</th>
                                            <th style={{ minWidth: 145 }}>Review State</th>
                                            <th style={{ minWidth: 80 }}>Dup.</th>
                                            <th style={{ minWidth: 110 }}>Deliverable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map((r) => {
                                            return (
                                                <tr key={r.id} className="rc-row-clickable" onClick={() => setDetailItem(r)}>
                                                    <td className="review-sticky-col review-sticky-check" onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" className="rc-checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                                                    </td>
                                                    <td className="review-sticky-col review-sticky-id" style={{ color: "#475569", fontWeight: 500, fontSize: 11 }} title={r.intakeId}>
                                                        {r.intakeId || <span style={{ color: "#94a3b8" }}>&mdash;</span>}
                                                    </td>
                                                    <td className="review-sticky-col review-sticky-title" style={{ fontWeight: 600, color: "#0f172a", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.title}>
                                                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                            {r.title}
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                <circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                        </span>
                                                    </td>
                                                    <td style={{ color: "#475569" }}>{r.communityNames[0] || <span style={{ color: "#94a3b8" }}>&mdash;</span>}</td>
                                                    <td>
                                                        <select value={r.category} onChange={e => { e.stopPropagation(); doEdit(r.id, { category: e.target.value }); }} style={SELECT_STYLE}>
                                                            {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select value={r.team} onChange={e => { e.stopPropagation(); doEdit(r.id, { team: e.target.value }); }} style={SELECT_STYLE}>
                                                            {TEAMS_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select value={r.priority} onChange={e => { e.stopPropagation(); doEdit(r.id, { priority: e.target.value as RecapRequest["priority"] }); }} style={SELECT_STYLE}>
                                                            {PRIORITIES_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <span className={`rc-badge ${r._reviewState === "Pending Review" ? "rc-badge-intake-awaiting" : r._reviewState === "Clarification Needed" ? "rc-badge-external-clarification" : r._reviewState === "Archived" ? "rc-badge-intake-duplicate" : "rc-badge-intake-converted"}`} style={{ fontSize: 10 }}>
                                                            {r._reviewState === "Ready to Publish" ? "Ready" : r._reviewState}
                                                        </span>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={r._reviewState}
                                                            onChange={(e) => persistReviewState(r.id, e.target.value as ReviewState)}
                                                            style={{ fontSize: 10, padding: "2px 18px 2px 4px", border: `1px solid ${REVIEW_STATE_COLORS[r._reviewState as ReviewState] || "#d1d5db"}`, borderLeft: `3px solid ${REVIEW_STATE_COLORS[r._reviewState as ReviewState] || "#d1d5db"}`, borderRadius: 4, background: "#fff", color: "#111827", fontWeight: 600, minWidth: 110, cursor: "pointer" }}
                                                        >
                                                            <option value="Ready to Publish">Ready to Publish</option>
                                                            <option value="Pending Review">Pending Review</option>
                                                            <option value="Clarification Needed">Clarification Needed</option>
                                                            <option value="Archived">Archived</option>
                                                        </select>
                                                    </td>
                                                    <td style={{ fontSize: 11, textAlign: "center" }}>
                                                        {r._potentialDuplicate ? (
                                                            <span title={DUP_TOOLTIP[r._duplicateType]} style={{ color: "#d97706", fontSize: 16, cursor: "help" }}>&#9888;</span>
                                                        ) : (
                                                            <span style={{ color: "#d1d5db" }}>&mdash;</span>
                                                        )}
                                                    </td>
                                                    <td style={{ color: "#475569", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r._deliverable}>{r._deliverable}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderTop: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                                <span>Showing {rangeStart}&ndash;{rangeEnd} of {filtered.length} items</span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <button className="rc-btn rc-btn-ghost rc-btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} style={{ fontSize: 11, padding: "2px 10px" }}>Previous</button>
                                    <span style={{ fontWeight: 600, color: "#334155" }}>Page {safePage + 1} of {totalPages}</span>
                                    <button className="rc-btn rc-btn-ghost rc-btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} style={{ fontSize: 11, padding: "2px 10px" }}>Next</button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="iq-empty-inbox" style={{ padding: "40px 20px" }}>
                            <div className="iq-empty-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                                </svg>
                            </div>
                            <span className="iq-empty-title">No items match your current filter.</span>
                            <span className="iq-empty-sub">
                                {activeCardFilter === "ready" ? "No items are marked Ready to Publish. Set review state in the drawer." :
                                 activeCardFilter === "pending" ? "All items have been reviewed or no items are pending review." :
                                 activeCardFilter === "archived" ? "No archived items. Use 'Archive as Duplicate' bulk action." :
                                 activeCardFilter === "clarification" ? "No items currently need clarification." :
                                 activeCardFilter === "critical" ? "No critical priority items." :
                                 "Try adjusting your search or filter criteria."}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {detailItem && (
                <RequestDetailDrawer
                    item={detailItem}
                    onClose={() => setDetailItem(null)}
                    onEdit={(id, patch) => { doEdit(id, patch); }}
                    onChangeReviewState={(id, s) => persistReviewState(id, s)}
                    reviewState={getReviewState(detailItem, getDupType(detailItem.id))}
                    duplicateType={getDupType(detailItem.id)}
                    categories={CATEGORIES_LIST}
                    teams={TEAMS_LIST}
                    priorities={PRIORITIES_LIST}
                />
            )}

            {toastMsg && (
                <div style={{ position: "fixed", bottom: 24, right: 24, background: "#0f172a", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 3000, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                    {toastMsg}
                </div>
            )}
        </div>
    );
}

function RequestDetailDrawer({ item, onClose, onEdit, onChangeReviewState, reviewState, duplicateType, categories, teams, priorities }: {
    item: RecapRequest;
    onClose: () => void;
    onEdit: (id: string, patch: Partial<RecapRequest>) => void;
    onChangeReviewState: (id: string, s: ReviewState) => void;
    reviewState: ReviewState;
    duplicateType: string;
    categories: string[];
    teams: string[];
    priorities: RecapRequest["priority"][];
}) {
    const DUP_TOOLTIP: Record<string, string> = {
        "Within Package": "Another request inside THIS uploaded package appears to request the same deliverable.",
        "Possible Match": "A similar request exists elsewhere and should be reviewed before creating another deliverable.",
        "Existing Request": "This request matches a previously published request in the tracker.",
    };

    const REVIEW_STATE_COLORS: Record<ReviewState, string> = {
        "Ready to Publish": "#166534",
        "Pending Review": "#1d4ed8",
        "Clarification Needed": "#92400e",
        "Archived": "#64748b",
    };

    return (
        <>
            <div className="rc-drawer-overlay" onClick={onClose} />
            <div className="rc-drawer iq-drawer" style={{ width: 520 }}>
                <div className="rc-drawer-header">
                    <div>
                        <h2>{item.title}</h2>
                        <div className="rc-drawer-sub">
                            <span className="rc-badge rc-badge-import" style={{ fontSize: 10, marginRight: 8 }}>
                                {item.requestId}
                            </span>
                            {duplicateType !== "None" && (
                                <span className="rc-badge rc-badge-intake-duplicate" style={{ fontSize: 10, marginRight: 8 }} title={DUP_TOOLTIP[duplicateType]}>{duplicateType}</span>
                            )}
                            <span className="rc-badge" style={{ fontSize: 10, background: REVIEW_STATE_COLORS[reviewState] || "#64748b", color: "#fff", padding: "2px 8px" }}>
                                {reviewState}
                            </span>
                        </div>
                    </div>
                    <button className="rc-drawer-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-drawer-body">
                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">External Upload Raw</div>
                        <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0 }}>
                            {item.title}
                        </p>
                        {item.description && (
                            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4, margin: "6px 0 0" }}>
                                {item.description}
                            </p>
                        )}
                        <div className="iq-detail-grid" style={{ marginTop: 8 }}>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Community</span>
                                <span className="rc-drawer-field-value">{item.communityNames.join(", ") || <span style={{ color: "#94a3b8" }}>&mdash;</span>}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Internal Engine Output</div>
                        <div className="iq-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Normalized Category</span>
                                <select value={item.category} onChange={e => onEdit(item.id, { category: e.target.value })} style={{ fontSize: 12, padding: "3px 20px 3px 6px", border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#111827" }}>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Suggested Team</span>
                                <select value={item.team} onChange={e => onEdit(item.id, { team: e.target.value })} style={{ fontSize: 12, padding: "3px 20px 3px 6px", border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#111827" }}>
                                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Priority Recommendation</span>
                                <select value={item.priority} onChange={e => onEdit(item.id, { priority: e.target.value as RecapRequest["priority"] })} style={{ fontSize: 12, padding: "3px 20px 3px 6px", border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#111827" }}>
                                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">AI Confidence</span>
                                <span className="rc-drawer-field-value">{Math.floor(hashId(item.id) % 15 + 82)}%</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Deliverable Suggestion</span>
                                <span className="rc-drawer-field-value">{item.title.split(" - ")[0]}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Internal Owner</span>
                                <span className="rc-drawer-field-value" style={{ color: "#64748b", fontStyle: "italic" }}>Unassigned (assign after publish)</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Potential Duplicate</span>
                                <span className={`rc-drawer-field-value`} style={{ color: duplicateType !== "None" ? "#d97706" : "#94a3b8", fontWeight: duplicateType !== "None" ? 600 : 400 }}>
                                    {duplicateType !== "None" ? <span>&#9888; {duplicateType}</span> : <span style={{ color: "#94a3b8" }}>&mdash;</span>}
                                </span>
                            </div>
                            {duplicateType !== "None" && (
                                <div className="rc-drawer-field">
                                    <span className="rc-drawer-field-label">Duplicate Reason</span>
                                    <span className="rc-drawer-field-value">
                                        {duplicateType === "Within Package" ? "Another request with similar title and community exists in this package. Archive if confirmed." :
                                         duplicateType === "Possible Match" ? "Title and scope partially match another request. Archive if confirmed." :
                                         "Matches a previously published request in the tracker. Archive if confirmed."}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Review State</div>
                        <select
                            value={reviewState}
                            onChange={e => onChangeReviewState(item.id, e.target.value as ReviewState)}
                            style={{ fontSize: 12, padding: "4px 20px 4px 8px", border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", color: "#111827", width: "100%" }}
                        >
                            <option value="Ready to Publish">Ready to Publish</option>
                            <option value="Pending Review">Pending Review</option>
                            <option value="Clarification Needed">Clarification Needed</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Activity Count</div>
                        <span style={{ fontSize: 13, color: "#64748b" }}>{Math.floor(hashId(item.id) % 7)} activities (placeholder)</span>
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Notes</div>
                        <textarea
                            placeholder="Add review notes (local only)..."
                            rows={3}
                            style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical", color: "#111827", font: "inherit", boxSizing: "border-box" }}
                        />
                    </div>
                </div>
                <div className="rc-drawer-actions iq-drawer-actions">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onClose}>Close</button>
                </div>
            </div>
        </>
    );
}

function AssignUserModal({ onClose, onAssign }: { onClose: () => void; onAssign: (user: RecapTeamMember) => void }) {
    const members = getTeamMembers();
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<RecapTeamMember | null>(null);
    const [confirming, setConfirming] = useState(false);
    const filtered = search.trim()
        ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) || m.team.toLowerCase().includes(search.toLowerCase()))
        : members;

    if (confirming && selectedUser) {
        return (
            <div className="rc-modal-overlay" onClick={onClose}>
                <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                    <div className="rc-modal-header">
                        <h2>Confirm Assignment</h2>
                        <button className="rc-modal-close" onClick={onClose}>&times;</button>
                    </div>
                    <div className="rc-modal-body" style={{ padding: "16px", textAlign: "center" }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#4338ca", margin: "0 auto 10px" }}>
                            {selectedUser.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 4px" }}>Assign to {selectedUser.name}?</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>All requests in this package will be assigned to {selectedUser.name} ({selectedUser.team}).</p>
                    </div>
                    <div className="rc-modal-footer">
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => { setConfirming(false); setSelectedUser(null); }}>Back</button>
                        <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => { onAssign(selectedUser); }}>Confirm Assignment</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <div className="rc-modal-header">
                    <h2>Assign User</h2>
                    <button className="rc-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                    <input type="text" placeholder="Search by name, email, or team..." value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, marginBottom: 8, boxSizing: "border-box" }} />
                    <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                        {filtered.map(m => (
                            <div key={m.id} className="rc-row-clickable" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4 }} onClick={() => { setSelectedUser(m); setConfirming(true); }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4338ca", flexShrink: 0 }}>
                                    {m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{m.name}</div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>{m.email} &middot; {m.team}</div>
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 12 }}>No matching users found.</div>}
                    </div>
                </div>
                <div className="rc-modal-footer">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

function RouteToTeamModal({ currentItem, onClose, onRoute }: { currentItem: RecapIntakeItem; onClose: () => void; onRoute: (team: string) => void }) {
    const teams = getTeams();
    const [selectedTeam, setSelectedTeam] = useState("");

    return (
        <div className="rc-modal-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="rc-modal-header">
                    <h2>Route to Team</h2>
                    <button className="rc-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-modal-body" style={{ padding: "12px 16px" }}>
                    <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px" }}>
                        Route "{currentItem.title}" to a team for review and processing.
                    </p>
                    <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} style={{ width: "100%", padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }}>
                        <option value="">Select a team...</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="rc-modal-footer">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={onClose}>Cancel</button>
                    <button className="rc-btn rc-btn-primary rc-btn-sm" disabled={!selectedTeam} onClick={() => { onRoute(selectedTeam); onClose(); }}>Route to {selectedTeam || "..."}</button>
                </div>
            </div>
        </div>
    );
}

function IntakeDrawer({
    item,
    onClose,
    notes,
    onAddNote,
}: {
    item: RecapIntakeItem;
    onClose: () => void;
    notes: Note[];
    onAddNote: (body: string) => void;
}) {
    const navigate = useNavigate();
    const config = SOURCE_CONFIG[item.type] || { icon: "\u2753", label: item.type, cssClass: "rc-badge-open" };
    const [newNoteText, setNewNoteText] = useState("");
    const [showAssign, setShowAssign] = useState(false);
    const [showRoute, setShowRoute] = useState(false);
    const [showConverted, setShowConverted] = useState(false);
    const [drawerBanner, setDrawerBanner] = useState<string | null>(null);

    const handleAction = (action: string) => {
        if (action === "review") {
            navigate(`/recapitalization/intake/review/${item.intakeId}`);
            return;
        }
        if (action === "assign") {
            setShowAssign(true);
            return;
        }
        if (action === "route") {
            setShowRoute(true);
            return;
        }
        if (action === "convert") {
            setShowConverted(true);
            return;
        }
    };

    const handleAddNote = () => {
        if (!newNoteText.trim()) return;
        onAddNote(newNoteText.trim());
        setNewNoteText("");
    };

    return (
        <>
            <div className="rc-drawer-overlay" onClick={onClose} />
            <div className="rc-drawer iq-drawer">
                <div className="rc-drawer-header">
                    <div>
                        <h2>{item.title}</h2>
                        <div className="rc-drawer-sub">
                            <span className={`rc-badge ${config.cssClass}`} style={{ fontSize: 10, marginRight: 8 }}>
                                {config.label}
                            </span>
                            <span className={`rc-badge ${STATUS_BADGE[item.status] || "rc-badge-open"}`} style={{ fontSize: 10 }}>
                                {item.status}
                            </span>
                        </div>
                    </div>
                    <button className="rc-drawer-close" onClick={onClose}>&times;</button>
                </div>
                <div className="rc-drawer-body">
                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Summary</div>
                        <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: 0 }}>
                            {item.description}
                        </p>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Original Submission</div>
                        <div className="iq-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Source</span>
                                <span className="rc-drawer-field-value">{config.label}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Submitted By</span>
                                <span className="rc-drawer-field-value">{item.submittedBy}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Transaction</span>
                                <span className="rc-drawer-field-value">{item.transactionName}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Submitted</span>
                                <span className="rc-drawer-field-value">{formatDate(item.submittedAt)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Suggested by Classification Engine</div>
                        <div className="iq-detail-grid">
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Category</span>
                                <span className="rc-drawer-field-value">{item.suggestedCategory || "\u2014"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Owner</span>
                                <span className="rc-drawer-field-value">{item.suggestedOwner || "\u2014"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Team</span>
                                <span className="rc-drawer-field-value">{item.suggestedTeam || "\u2014"}</span>
                            </div>
                            <div className="rc-drawer-field">
                                <span className="rc-drawer-field-label">Priority</span>
                                {item.suggestedPriority ? (
                                    <span className={`rc-badge ${PRIORITY_BADGE[item.suggestedPriority]}`} style={{ fontSize: 10, alignSelf: "flex-start" }}>
                                        {item.suggestedPriority}
                                    </span>
                                ) : (
                                    <span className="rc-drawer-field-value">\u2014</span>
                                )}
                            </div>
                        </div>
                        {(item.suggestedCommunities?.length ?? 0) > 0 && (
                            <div className="rc-drawer-field" style={{ marginTop: 4 }}>
                                <span className="rc-drawer-field-label">Communities</span>
                                <div className="rc-flex-center" style={{ gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                                    {item.suggestedCommunities!.map((c) => (
                                        <span key={c} className="rc-badge rc-badge-open" style={{ fontSize: 10, padding: "1px 6px" }}>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Activity</div>
                        <div className="rc-timeline">
                            <div className="rc-timeline-item">
                                <div className="rc-timeline-dot" />
                                <div className="rc-timeline-line" />
                                <div className="rc-timeline-content">
                                    <span className="rc-timeline-desc">Submitted by {item.submittedBy}</span>
                                    <span className="rc-timeline-meta">{timeAgo(item.submittedAt)}</span>
                                </div>
                            </div>
                            <div className="rc-timeline-item">
                                <div className="rc-timeline-dot" style={{ background: "#e2e8f0" }} />
                                <div className="rc-timeline-content">
                                    <span className="rc-timeline-desc" style={{ color: "#64748b" }}>Awaiting review</span>
                                    <span className="rc-timeline-meta">Pending action</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="rc-divider" />

                    <div className="rc-drawer-section">
                        <div className="rc-drawer-section-title">Notes &amp; Comments</div>
                        <div className="rc-notes-section">
                            {notes.map((note) => (
                                <div key={note.id} className="rc-note-item">
                                    <div className="rc-note-header">
                                        <span className="rc-note-author">{note.author}</span>
                                        <span>{timeAgo(note.timestamp)}</span>
                                    </div>
                                    <div className="rc-note-body">{note.body}</div>
                                </div>
                            ))}
                            <div className="rc-note-input">
                                <textarea
                                    placeholder="Add a note..."
                                    value={newNoteText}
                                    onChange={(e) => setNewNoteText(e.target.value)}
                                />
                                <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={handleAddNote} style={{ alignSelf: "flex-end" }}>
                                    Add Note
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {drawerBanner && (
                    <div style={{
                        margin: "8px 16px", padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0",
                    }}>
                        {drawerBanner}
                        <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ marginLeft: 8, color: "#166534", fontSize: 10 }} onClick={() => setDrawerBanner(null)}>OK</button>
                    </div>
                )}
                <div className="rc-drawer-actions iq-drawer-actions">
                    <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => handleAction("review")}>
                        Open Review
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("assign")}>
                        Assign
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("route")}>
                        Route to Team
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("convert")}>
                        Convert to Official Request
                    </button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => handleAction("respond")}>
                        Respond
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }} onClick={() => handleAction("reject")}>
                        Reject
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#92400e" }} onClick={() => handleAction("duplicate")}>
                        Mark Duplicate
                    </button>
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#92400e" }} onClick={() => handleAction("na")}>
                        Mark Not Applicable
                    </button>
                </div>
            </div>
            {showAssign && (
                <AssignUserModal
                    onClose={() => setShowAssign(false)}
                    onAssign={(user) => {
                        const reqs = getRequests().filter(r => r.transactionId === item.transactionId);
                        const ids = reqs.map(r => r.id);
                        const count = bulkUpdateDemoRequests(ids, { owner: user.name, assignedTo: user.name });
                        setShowAssign(false);
                        setDrawerBanner(`Assigned ${count} request${count !== 1 ? "s" : ""} to ${user.name}`);
                        setTimeout(() => setDrawerBanner(null), 6000);
                    }}
                />
            )}
            {showRoute && (
                <RouteToTeamModal
                    currentItem={item}
                    onClose={() => setShowRoute(false)}
                    onRoute={(team) => {
                        const reqs = getRequests().filter(r => r.transactionId === item.transactionId);
                        const ids = reqs.map(r => r.id);
                        const count = bulkUpdateDemoRequests(ids, { team });
                        setShowRoute(false);
                        setDrawerBanner(`Routed ${count} request${count !== 1 ? "s" : ""} to ${team}`);
                        setTimeout(() => setDrawerBanner(null), 4000);
                    }}
                />
            )}
            {showConverted && (
                <div className="rc-modal-overlay" onClick={() => setShowConverted(false)}>
                    <div className="rc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div className="rc-modal-header">
                            <h2>Convert to Official Request</h2>
                            <button className="rc-modal-close" onClick={() => setShowConverted(false)}>&times;</button>
                        </div>
                        <div className="rc-modal-body" style={{ padding: "16px", textAlign: "center" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: 0 }}>{item.title} converted!</p>
                            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>This intake item is now an official DD request in the tracker.</p>
                        </div>
                        <div className="rc-modal-footer">
                            <button className="rc-btn rc-btn-primary rc-btn-sm" onClick={() => setShowConverted(false)}>Done</button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}

export default function RecapitalizationIntake() {
    return (
        <Routes>
            <Route index element={<IntakeQueue />} />
            <Route path="review/:intakeId" element={<ReviewEngine />} />
        </Routes>
    );
}

function IntakeQueue() {
    const navigate = useNavigate();
    const [selectedItem, setSelectedItem] = useState<RecapIntakeItem | null>(null);
    const [filterType, setFilterType] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [notesByItem, setNotesByItem] = useState<Record<string, Note[]>>({});
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [msg, setMsg] = useState("");

    const allItems = useMemo(() => getIntakeItems(), []);

    const stats = useMemo(() => {
        return {
            newRequests: allItems.filter((i) => i.type === "External New Request" && i.status === "Awaiting Review").length,
            questions: allItems.filter((i) => i.type === "External Question" && i.status === "Awaiting Review").length,
            clarifications: allItems.filter((i) => i.type === "External Clarification" && i.status === "Awaiting Review").length,
            accessRequests: allItems.filter((i) => i.type === "Access Request" && i.status === "Awaiting Review").length,
            brokerUploads: allItems.filter((i) => i.type === "Broker Upload" && i.status === "Awaiting Review").length,
            needsAssignment: allItems.filter((i) => !i.assignedTo && (i.status === "Awaiting Review" || i.status === "Assigned")).length,
        };
    }, [allItems]);

    const visibleItems = useMemo(() => {
        let result = allItems;
        if (activeCardFilter === "__needs_assignment__") {
            result = result.filter((i) => !i.assignedTo && (i.status === "Awaiting Review" || i.status === "Assigned"));
        } else if (activeCardFilter) {
            result = result.filter((i) => i.type === activeCardFilter);
        } else if (filterType !== "All") {
            result = result.filter((i) => i.type === filterType);
        }
        if (!searchQuery.trim()) return result;
        const q = searchQuery.toLowerCase();
        return result.filter(
            (i) =>
                i.title.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.transactionName.toLowerCase().includes(q) ||
                i.submittedBy.toLowerCase().includes(q),
        );
    }, [allItems, activeCardFilter, filterType, searchQuery]);

    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id));

    const handleCardFilter = (key: string) => {
        const mappedType = CARD_FILTER_MAP[key];
        if (activeCardFilter === mappedType) {
            setActiveCardFilter(null);
            setFilterType("All");
        } else {
            setActiveCardFilter(mappedType);
            if (mappedType && mappedType !== "__needs_assignment__") {
                setFilterType(mappedType);
            }
        }
    };

    const handleDropdownChange = (value: string) => {
        setFilterType(value);
        setActiveCardFilter(null);
    };

    const clearCardFilter = () => {
        setActiveCardFilter(null);
        setFilterType("All");
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleItems.map((i) => i.id)));
        }
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleRowClick = (item: RecapIntakeItem) => {
        if (item.type === "Broker Upload") {
            setSelectedItem(item);
            if (!notesByItem[item.id]) {
                setNotesByItem((prev) => ({
                    ...prev,
                    [item.id]: DEFAULT_NOTES,
                }));
            }
        } else {
            navigate(`/recapitalization/workspace/${item.intakeId}`);
        }
    };

    const handleAddNote = (itemId: string, body: string) => {
        const note: Note = {
            id: `n-${Date.now()}`,
            author: "Current User",
            timestamp: new Date().toISOString(),
            body,
        };
        setNotesByItem((prev) => ({
            ...prev,
            [itemId]: [...(prev[itemId] || DEFAULT_NOTES), note],
        }));
    };

    return (
        <div className="rc-page iq-page">
            <RecapSubNav />

            <div className="rc-header">
                <div className="rc-header-left">
                    <h1>Intake Queue</h1>
                    {isDemoActive() && <span className="rc-badge rc-badge-visible" style={{ fontSize: 10, marginLeft: 8 }}>ABC Demo Active</span>}
                    <span className="rc-badge rc-badge-import" style={{ fontSize: 11, padding: "3px 10px" }}>
                        Command Center
                    </span>
                </div>
                <div className="rc-header-actions">
                    <button className="rc-btn rc-btn-ghost rc-btn-sm">Refresh</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm" onClick={() => setImportModalOpen(true)}>Import DD Package</button>
                    <button className="rc-btn rc-btn-secondary rc-btn-sm">New Intake Item</button>
                </div>
            </div>

            <div className="iq-stats-row">
                <div
                    className={`iq-stat-card iq-stat-blue ${activeCardFilter === "External New Request" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("newRequests")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.newRequests}</span>
                    <span className="iq-stat-label">New DD Requests</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-green ${activeCardFilter === "External Question" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("questions")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.questions}</span>
                    <span className="iq-stat-label">Questions</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-amber ${activeCardFilter === "External Clarification" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("clarifications")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.clarifications}</span>
                    <span className="iq-stat-label">Clarifications</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-gray ${activeCardFilter === "Access Request" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("accessRequests")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.accessRequests}</span>
                    <span className="iq-stat-label">Access Requests</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-indigo ${activeCardFilter === "Broker Upload" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("brokerUploads")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                            <path d="M9 15l3 3 3-3" />
                            <path d="M12 12v6" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.brokerUploads}</span>
                    <span className="iq-stat-label">Broker Uploads Ready</span>
                </div>
                <div
                    className={`iq-stat-card iq-stat-rose ${activeCardFilter === "__needs_assignment__" ? "iq-stat-filtered" : ""}`}
                    onClick={() => handleCardFilter("needsAssignment")}
                >
                    <div className="iq-stat-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#be123c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <span className="iq-stat-count">{stats.needsAssignment}</span>
                    <span className="iq-stat-label">Needs Assignment</span>
                </div>
            </div>

            <div className="iq-inbox-section">
                <div className="rc-card">
                    <div className="rc-card-header">
                        <h2>
                            Intake Inbox
                            <span className="rc-text-muted" style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                                {visibleItems.length} items
                            </span>
                            {activeCardFilter && (
                                <button className="rc-clear-filter" onClick={clearCardFilter} style={{ marginLeft: 8 }}>
                                    Clear filter
                                </button>
                            )}
                        </h2>
                        <div className="rc-flex-center" style={{ gap: 8 }}>
                            <div className="iq-search-box">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search intake..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <select
                                className="rc-filter-select"
                                value={filterType}
                                onChange={(e) => handleDropdownChange(e.target.value)}
                                style={{ minWidth: 140 }}
                            >
                                <option value="All">All Sources</option>
                                <option value="Broker Upload">Broker Upload</option>
                                <option value="External Question">External Question</option>
                                <option value="External Clarification">External Clarification</option>
                                <option value="External New Request">External New Request</option>
                                <option value="Access Request">Access Request</option>
                                <option value="Manual Internal Request">Manual Internal Request</option>
                            </select>
                        </div>
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="rc-bulk-bar">
                            <span>
                                <span className="rc-bulk-count">{selectedIds.size}</span> selected
                            </span>
                            <div className="rc-bulk-sep" />
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setMsg("Assign — coming soon")}>Assign</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setMsg("Route to Team — coming soon")}>Route to Team</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setMsg("Mark Duplicate")}>Mark Duplicate</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={() => setMsg("Mark Not Applicable")}>Mark Not Applicable</button>
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#991b1b" }} onClick={() => setMsg("Reject")}>Reject</button>
                            <div className="rc-bulk-sep" />
                            <button className="rc-btn rc-btn-ghost rc-btn-sm" onClick={clearSelection}>Clear Selection</button>
                        </div>
                    )}

                    <div className="rc-card-body" style={{ padding: 0 }}>
                        {visibleItems.length > 0 ? (
                            <table className="rc-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 16, paddingRight: 4 }}>
                                            <input
                                                type="checkbox"
                                                className="rc-checkbox-header"
                                                checked={allVisibleSelected}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th>Intake ID</th>
                                        <th>Type</th>
                                        <th>Title</th>
                                        <th>Transaction</th>
                                        <th>Source</th>
                                        <th>Community</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th>Assigned To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleItems.map((item, idx) => {
                                        const config = SOURCE_CONFIG[item.type] || { icon: "\u2753", label: item.type, cssClass: "rc-badge-open" };
                                        const isBrokerUpload = item.type === "Broker Upload";
                                        const rowBg = isBrokerUpload
                                            ? (idx % 2 === 1 ? "#edf2ff" : "#f8faff")
                                            : (idx % 2 === 1 ? "#fafbfc" : undefined);
                                        return (
                                            <tr
                                                key={item.id}
                                                className="rc-row-clickable"
                                                onClick={() => handleRowClick(item)}
                                                style={rowBg ? { background: rowBg } : undefined}
                                            >
                                                <td style={{ width: 16, paddingRight: 4 }} onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="rc-checkbox"
                                                        checked={selectedIds.has(item.id)}
                                                        onChange={() => toggleSelect(item.id)}
                                                    />
                                                </td>
                                                <td style={{ fontFamily: '"SF Mono", "Cascadia Code", "Consolas", monospace', fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                                    {item.intakeId}
                                                </td>
                                                <td>
                                                    <span className={`rc-badge ${config.cssClass}`} style={{ fontSize: 10 }}>
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "#0f172a" }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        {isBrokerUpload && (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                                                                <polyline points="13 2 13 9 20 9" />
                                                            </svg>
                                                        )}
                                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {isBrokerUpload ? (item.fileName || item.title) : item.title}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569" }}>
                                                    {item.transactionName}
                                                </td>
                                                <td style={{ color: "#475569" }}>{item.submittedBy}</td>
                                                <td style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569", fontSize: 12 }}>
                                                    {item.communityNames.length > 0
                                                        ? item.communityNames.slice(0, 2).join(", ") + (item.communityNames.length > 2 ? ` +${item.communityNames.length - 2}` : "")
                                                        : "\u2014"}
                                                </td>
                                                <td style={{ color: "#64748b", fontSize: 12 }}>{timeAgo(item.submittedAt)}</td>
                                                <td>
                                                    <span className={`rc-badge ${STATUS_BADGE[item.status] || "rc-badge-open"}`} style={{ fontSize: 10 }}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: 12 }}>
                                                    {item.assignedTo || (
                                                        <span style={{ color: "#d97706", fontWeight: 600 }}>Unassigned</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="iq-empty-inbox">
                                <div className="iq-empty-icon">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                                    </svg>
                                </div>
                                <span className="iq-empty-title">All caught up!</span>
                                <span className="iq-empty-sub">No items match your current filter.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedItem && (
                <IntakeDrawer
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    notes={notesByItem[selectedItem.id] || DEFAULT_NOTES}
                    onAddNote={(body) => handleAddNote(selectedItem.id, body)}
                />
            )}

            {importModalOpen && (
                <ImportModal
                    onClose={() => setImportModalOpen(false)}
                    onImport={(_name) => {
                        setImportModalOpen(false);
                    }}
                />
            )}
            {msg && (
                <div style={{ position: "fixed", bottom: 16, right: 16, background: "#1e293b", color: "#fff", padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600, zIndex: 9999, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                    {msg}
                    <button className="rc-btn rc-btn-ghost rc-btn-sm" style={{ color: "#fff", marginLeft: 8, fontSize: 11 }} onClick={() => setMsg("")}>OK</button>
                </div>
            )}
        </div>
    );
}
