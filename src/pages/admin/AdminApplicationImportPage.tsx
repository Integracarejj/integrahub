import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { usePermissions, isPlatformAdmin } from "../../hooks/usePermissions";
import { getAuthHeaders } from "../../utils/authHeaders";
import "./AdminPage.css";

interface InputRow {
    application: string;
    category: string;
    vendor: string;
    website: string;
    description: string;
    dataClassification: string;
    confidentialityRisk: string;
    integrityRisk: string;
    availabilityRisk: string;
    owner: string;
    ownerBackup: string;
    numberOfUsers: string;
    comments: string;
}

interface RegistryFields {
    name: string;
    vendor: string;
    description: string;
    businessOwner: string;
    status: string;
    type: string;
    systemCategory: string | null;
    businessCriticality: string;
    impactIfDown: string;
    backupOwner: string;
    dataClassification: string;
    capabilityId: string | null;
    capabilityName: string | null;
    notes: string;
    userCountBand: string;
}

interface ExistingApp {
    id: string;
    name: string;
    vendor: string;
    capabilityId: string;
    businessOwner: string;
    technicalOwner: string;
    businessCriticality: string;
    status: string;
}

interface ExactMatch {
    registryRow: RegistryFields;
    existingApplication: ExistingApp;
}

interface LikelyMatch {
    registryRow: RegistryFields;
    existingApplication: ExistingApp;
}

interface WouldCreate {
    registryRow: RegistryFields;
    suggestedCapability: { id: string; name: string } | null;
}

interface NeedsReview {
    row: Record<string, string>;
    reason: string;
}

interface ImportPreviewResult {
    summary: {
        totalRows: number;
        exactMatches: number;
        likelyMatches: number;
        wouldCreate: number;
        wouldUpdate: number;
        needsReview: number;
    };
    exactMatches: ExactMatch[];
    likelyMatches: LikelyMatch[];
    wouldCreate: WouldCreate[];
    wouldUpdate: unknown[];
    needsReview: NeedsReview[];
}

const COLUMN_ALIASES: [string, keyof InputRow][] = [
    ["Application", "application"],
    ["Category", "category"],
    ["Vendor", "vendor"],
    ["Website", "website"],
    ["Description", "description"],
    ["Data Classification", "dataClassification"],
    ["Confidentiality Risk", "confidentialityRisk"],
    ["Integrity Risk", "integrityRisk"],
    ["Availability Risk", "availabilityRisk"],
    ["Owner", "owner"],
    ["Owner-Backup", "ownerBackup"],
    ["Owner Backup", "ownerBackup"],
    ["Number of Users", "numberOfUsers"],
    ["Comments", "comments"],
];

function findColumnKey(header: string): keyof InputRow | null {
    const h = header.trim().toLowerCase();
    for (const [alias, key] of COLUMN_ALIASES) {
        if (alias.toLowerCase() === h) return key;
    }
    return null;
}

async function parseFile(file: File): Promise<InputRow[]> {
    const buffer = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("File has no worksheets");
    const sheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rawRows.length === 0) return [];

    const headers = Object.keys(rawRows[0]);
    const columnMap = new Map<string, keyof InputRow>();
    for (const h of headers) {
        const key = findColumnKey(h);
        if (key) columnMap.set(h, key);
    }

    return rawRows.map((raw) => {
        const row: InputRow = {
            application: "", category: "", vendor: "", website: "", description: "",
            dataClassification: "", confidentialityRisk: "", integrityRisk: "",
            availabilityRisk: "", owner: "", ownerBackup: "", numberOfUsers: "", comments: "",
        };
        for (const [header, value] of Object.entries(raw)) {
            const key = columnMap.get(header);
            if (key) {
                row[key] = String(value);
            }
        }
        return row;
    });
}

type SectionKey = "exact" | "likely" | "create" | "review";

export default function AdminApplicationImportPage() {
    const { permissions, loading: permissionsLoading } = usePermissions();
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportPreviewResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
        exact: true, likely: true, create: true, review: false,
    });
    const inputRef = useRef<HTMLInputElement>(null);

    if (permissionsLoading) {
        return <div className="admin-page" style={{ padding: "40px", textAlign: "center" }}><p>Loading...</p></div>;
    }

    if (!isPlatformAdmin(permissions)) {
        return (
            <div className="admin-page" style={{ padding: "40px", textAlign: "center" }}>
                <h1>Access Denied</h1>
                <p>You do not have access to this page.</p>
                <Link to="/" className="create-btn">Go to Home</Link>
            </div>
        );
    }

    function toggleSection(key: SectionKey) {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    }

    function SectionHeader({ title, count, sectionKey }: { title: string; count: number; sectionKey: SectionKey }) {
        const open = expanded[sectionKey];
        return (
            <button
                className="collapsible-header"
                onClick={() => toggleSection(sectionKey)}
                type="button"
                style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 8 }}
            >
                <span className="collapsible-icon">{open ? "−" : "+"}</span>
                <h2>{title} ({count})</h2>
            </button>
        );
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setResult(null);
        setError(null);
    }

    async function handlePreview() {
        if (!file) return;
        setParsing(true);
        setError(null);
        setResult(null);
        try {
            const rows = await parseFile(file);
            if (rows.length === 0) {
                setError("No rows found in file. Check column headers match expected names (e.g. Application, Category, Vendor, etc.).");
                return;
            }
            setParsing(false);
            setLoading(true);

            const res = await fetch("/api/admin/applications/import-preview", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(rows),
            });

            if (!res.ok) {
                const err = await res.text();
                setError(`Request failed (${res.status}): ${err}`);
                return;
            }

            const data: ImportPreviewResult = await res.json();
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to process file");
        } finally {
            setParsing(false);
            setLoading(false);
        }
    }

    function handleReset() {
        setFile(null);
        setResult(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = "";
    }

    return (
        <div className="admin-page">
            <header className="page-header">
                <h1>Application Import Preview</h1>
                <Link to="/admin" className="back-link">Back to Admin</Link>
            </header>

            <div className="admin-section">
                <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>
                    Upload an application registry spreadsheet (.xlsx or .csv) to preview how it would be imported.
                    Matching is done against existing CMDB applications. No changes are made during preview.
                </p>

                <div className="add-user-form" style={{ gap: 12 }}>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,.csv"
                        onChange={handleFileChange}
                        className="user-input"
                        style={{ padding: 8 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="admin-btn"
                            onClick={handlePreview}
                            disabled={!file || parsing || loading}
                        >
                            {parsing ? "Parsing..." : loading ? "Loading..." : "Preview Import"}
                        </button>
                        {result && (
                            <button className="admin-btn" onClick={handleReset} style={{ background: "#6b7280" }}>
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            {loading && <p style={{ color: "#6b7280" }}>Processing...</p>}

            {result && (
                <>
                    <div className="sync-readiness ready" style={{ marginTop: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                            <SummaryCard label="Total Rows" value={result.summary.totalRows} />
                            <SummaryCard label="Exact Matches" value={result.summary.exactMatches} color="#166534" bg="#e8f5ee" />
                            <SummaryCard label="Likely Matches" value={result.summary.likelyMatches} color="#92400e" bg="#fffbeb" />
                            <SummaryCard label="Would Create" value={result.summary.wouldCreate} color="#1d4ed8" bg="#eff6ff" />
                            <SummaryCard label="Would Update" value={result.summary.wouldUpdate} color="#6b7280" bg="#f9fafb" />
                            <SummaryCard label="Needs Review" value={result.summary.needsReview} color="#991b1b" bg="#fef2f2" />
                        </div>
                    </div>

                    {result.exactMatches.length > 0 && (
                        <>
                            <SectionHeader title="Exact Matches" count={result.exactMatches.length} sectionKey="exact" />
                            {expanded.exact && (
                                <table className="user-table">
                                    <thead>
                                        <tr>
                                            <th>Registry Name</th>
                                            <th>CMDB Name</th>
                                            <th>Vendor</th>
                                            <th>Category</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.exactMatches.map((m, i) => (
                                            <tr key={i}>
                                                <td>{m.registryRow.name}</td>
                                                <td>{m.existingApplication.name}</td>
                                                <td>{m.registryRow.vendor || "—"}</td>
                                                <td>{m.registryRow.capabilityName || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {result.likelyMatches.length > 0 && (
                        <>
                            <SectionHeader title="Likely Matches" count={result.likelyMatches.length} sectionKey="likely" />
                            {expanded.likely && (
                                <table className="user-table">
                                    <thead>
                                        <tr>
                                            <th>Registry Name</th>
                                            <th>Likely CMDB Match</th>
                                            <th>Vendor</th>
                                            <th>Category</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.likelyMatches.map((m, i) => (
                                            <tr key={i}>
                                                <td>{m.registryRow.name}</td>
                                                <td>{m.existingApplication.name}</td>
                                                <td>{m.registryRow.vendor || "—"}</td>
                                                <td>{m.registryRow.capabilityName || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {result.wouldCreate.length > 0 && (
                        <>
                            <SectionHeader title="Would Create" count={result.wouldCreate.length} sectionKey="create" />
                            {expanded.create && (
                                <table className="user-table">
                                    <thead>
                                        <tr>
                                            <th>Application</th>
                                            <th>Suggested Capability</th>
                                            <th>Suggested Category</th>
                                            <th>Criticality</th>
                                            <th>Owner</th>
                                            <th>Vendor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.wouldCreate.map((c, i) => (
                                            <tr key={i}>
                                                <td>{c.registryRow.name}</td>
                                                <td>{c.suggestedCapability?.name || "—"}</td>
                                                <td>{c.registryRow.systemCategory || "—"}</td>
                                                <td>{c.registryRow.businessCriticality || "—"}</td>
                                                <td>{c.registryRow.businessOwner || "—"}</td>
                                                <td>{c.registryRow.vendor || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    {result.needsReview.length > 0 && (
                        <>
                            <SectionHeader title="Needs Review" count={result.needsReview.length} sectionKey="review" />
                            {expanded.review && (
                                <table className="user-table">
                                    <thead>
                                        <tr>
                                            <th>Reason</th>
                                            <th>Name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.needsReview.map((r, i) => (
                                            <tr key={i}>
                                                <td style={{ color: "#991b1b" }}>{r.reason}</td>
                                                <td>{r.row.application || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}

                    <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>
                        Preview only. No data was written to the database.
                    </p>
                </>
            )}
        </div>
    );
}

function SummaryCard({ label, value, color, bg }: { label: string; value: number; color?: string; bg?: string }) {
    return (
        <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: bg || "#f9fafb",
            textAlign: "center",
        }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: color || "#111827" }}>{value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
        </div>
    );
}
