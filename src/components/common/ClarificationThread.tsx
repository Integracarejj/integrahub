import type { WorkNoteEntry } from "../../services/recapMockData";

export interface ClarificationThreadProps {
    workNotes: WorkNoteEntry[];
    statusNotes: string | null | undefined;
    questionAuthor?: string | null;
    isExternal?: boolean;
    excludeQuestion?: boolean;
}

export interface ThreadEntry {
    id: string;
    type: "Contributor Question" | "Contributor Context" | "DD Operations Guidance" | "External Question" | "External Partner Response" | "DD Operations Final Guidance" | "Internal Follow-up";
    author: string;
    role: string;
    timestamp: string;
    message: string;
    audience: "Internal" | "External";
}

export interface ClarificationSummary {
    originalQuestion: string | null;
    questionAuthor: string | null;
    contributorContext: string | null;
    ddOpsResponse: string | null;
    ddOpsResponseAuthor: string | null;
    ddOpsResponseTimestamp: string | null;
    externalQuestion: string | null;
    externalQuestionAuthor: string | null;
    externalQuestionTimestamp: string | null;
    externalResponse: string | null;
    externalResponseAuthor: string | null;
    externalResponseTimestamp: string | null;
    finalGuidance: string | null;
    finalGuidanceAuthor: string | null;
    finalGuidanceTimestamp: string | null;
    currentState: "none" | "awaiting-dd-ops" | "awaiting-external" | "external-responded" | "resolved";
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Canonical clarification summary.
 * Derives one source of truth for every clarification field from work notes and statusNotes.
 */
export function getClarificationSummary({ workNotes, statusNotes, questionAuthor }: ClarificationThreadProps): ClarificationSummary {
    const notes = workNotes || [];
    const findFirst = (action: string) => notes.find(n => n.action === action);
    const findAll = (action: string) => notes.filter(n => n.action === action);

    // Original question: prefer the "Clarification Needed" work note; fall back to statusNotes
    const clarNeededNote = findFirst("Clarification Needed");
    const originalQuestion = clarNeededNote?.text || statusNotes || null;
    const question = clarNeededNote ? (questionAuthor || clarNeededNote.author) : questionAuthor || null;

    // Contributor context
    const contextNote = findFirst("Clarification Context");
    const contributorContext = contextNote?.text || null;

    // DD Operations internal response (not from external partner)
    const ddResponseNotes = findAll("Clarification Response").filter(n => n.author !== "External Partner");
    const ddOpsResponse = ddResponseNotes.length > 0 ? ddResponseNotes[ddResponseNotes.length - 1].text : null;
    const ddOpsResponseAuthor = ddResponseNotes.length > 0 ? ddResponseNotes[ddResponseNotes.length - 1].author : null;
    const ddOpsResponseTimestamp = ddResponseNotes.length > 0 ? ddResponseNotes[ddResponseNotes.length - 1].timestamp : null;

    // External question
    const extQuestionNote = findFirst("Clarification External Question");
    const externalQuestion = extQuestionNote?.text || null;
    const externalQuestionAuthor = extQuestionNote?.author || null;
    const externalQuestionTimestamp = extQuestionNote?.timestamp || null;

    // External partner response
    const extResponseNotes = findAll("Clarification Response").filter(n => n.author === "External Partner");
    const externalResponse = extResponseNotes.length > 0 ? extResponseNotes[extResponseNotes.length - 1].text : null;
    const externalResponseAuthor = extResponseNotes.length > 0 ? extResponseNotes[extResponseNotes.length - 1].author : null;
    const externalResponseTimestamp = extResponseNotes.length > 0 ? extResponseNotes[extResponseNotes.length - 1].timestamp : null;

    // Final guidance
    const guidanceNote = findFirst("Clarification Guidance");
    const finalGuidance = guidanceNote?.text || null;
    const finalGuidanceAuthor = guidanceNote?.author || null;
    const finalGuidanceTimestamp = guidanceNote?.timestamp || null;

    // Current state
    let currentState: ClarificationSummary["currentState"] = "none";
    if (originalQuestion) {
        if (externalResponse) {
            currentState = finalGuidance ? "resolved" : "external-responded";
        } else if (externalQuestion) {
            currentState = "awaiting-external";
        } else if (ddOpsResponse) {
            currentState = "resolved";
        } else {
            currentState = "awaiting-dd-ops";
        }
    }

    return {
        originalQuestion,
        questionAuthor: question,
        contributorContext,
        ddOpsResponse,
        ddOpsResponseAuthor,
        ddOpsResponseTimestamp,
        externalQuestion,
        externalQuestionAuthor,
        externalQuestionTimestamp,
        externalResponse,
        externalResponseAuthor,
        externalResponseTimestamp,
        finalGuidance,
        finalGuidanceAuthor,
        finalGuidanceTimestamp,
        currentState,
    };
}

/**
 * Canonical clarification thread.
 * Deduplicates entries using normalized text comparison.
 * Returns entries in chronological order with stable IDs.
 */
export function getClarificationThread({ workNotes, statusNotes, questionAuthor }: ClarificationThreadProps): ThreadEntry[] {
    const entries: ThreadEntry[] = [];
    const seen = new Set<string>();
    const notes = workNotes || [];

    // Add the original question from statusNotes ONLY if no "Clarification Needed" work note exists
    const hasClarNeededWorkNote = notes.some(n => n.action === "Clarification Needed");
    if (statusNotes && !hasClarNeededWorkNote) {
        const norm = normalizeText(statusNotes);
        if (!seen.has(norm)) {
            seen.add(norm);
            entries.push({
                id: "question-original",
                type: "Contributor Question",
                author: questionAuthor || "Contributor",
                role: "Contributor",
                timestamp: "",
                message: statusNotes,
                audience: "Internal",
            });
        }
    }

    // Process work notes
    for (const note of notes) {
        if (!note.action) continue;

        const norm = normalizeText(note.text);
        // Skip duplicate question text that matches statusNotes (presentation-layer dedup)
        if (statusNotes && normalizeText(statusNotes) === norm && note.action === "Clarification Needed") {
            // Use the work note entry (has ID + timestamp) instead of synthetic statusNotes entry
            if (seen.has("__question_from_wn")) continue;
            seen.add("__question_from_wn");
        }

        if (seen.has(norm) && note.action !== "Work Note") {
            // Skip duplicate message text (conservative dedup for same message, same action)
            continue;
        }

        switch (note.action) {
            case "Clarification Needed":
                seen.add(norm);
                entries.push({
                    id: note.id,
                    type: "Contributor Question",
                    author: note.author,
                    role: "Contributor",
                    timestamp: note.timestamp,
                    message: note.text,
                    audience: "Internal",
                });
                break;
            case "Clarification Response":
                if (note.author === "External Partner") {
                    seen.add(norm);
                    entries.push({
                        id: note.id,
                        type: "External Partner Response",
                        author: note.author,
                        role: "External Partner",
                        timestamp: note.timestamp,
                        message: note.text,
                        audience: "Internal",
                    });
                } else {
                    seen.add(norm);
                    entries.push({
                        id: note.id,
                        type: "DD Operations Guidance",
                        author: note.author,
                        role: "DD Operations",
                        timestamp: note.timestamp,
                        message: note.text,
                        audience: "Internal",
                    });
                }
                break;
            case "Clarification External Question":
                seen.add(norm);
                entries.push({
                    id: note.id,
                    type: "External Question",
                    author: note.author,
                    role: "DD Operations",
                    timestamp: note.timestamp,
                    message: note.text,
                    audience: "External",
                });
                break;
            case "Clarification Guidance":
                seen.add(norm);
                entries.push({
                    id: note.id,
                    type: "DD Operations Final Guidance",
                    author: note.author,
                    role: "DD Operations",
                    timestamp: note.timestamp,
                    message: note.text,
                    audience: "Internal",
                });
                break;
            case "Clarification Context":
                seen.add(norm);
                entries.push({
                    id: note.id,
                    type: "Contributor Context",
                    author: note.author,
                    role: "Contributor",
                    timestamp: note.timestamp,
                    message: note.text,
                    audience: "Internal",
                });
                break;
            default:
                break;
        }
    }

    return entries;
}

function getEntryStyle(type: ThreadEntry["type"]): { bg: string; border: string; icon: string; color: string } {
    switch (type) {
        case "Contributor Question":
            return { bg: "#fffbeb", border: "#fde68a", icon: "?", color: "#92400e" };
        case "Contributor Context":
            return { bg: "#fffbeb", border: "#fde68a", icon: "i", color: "#92400e" };
        case "DD Operations Guidance":
            return { bg: "#ecfeff", border: "#a5f3fc", icon: "\u2192", color: "#0e7490" };
        case "DD Operations Final Guidance":
            return { bg: "#ecfeff", border: "#67e8f9", icon: "\u2192", color: "#0e7490" };
        case "External Question":
            return { bg: "#f0f9ff", border: "#bae6fd", icon: "\u2709", color: "#0369a1" };
        case "External Partner Response":
            return { bg: "#f0fdf4", border: "#bbf7d0", icon: "\u2713", color: "#166534" };
        case "Internal Follow-up":
            return { bg: "#f8fafc", border: "#e2e8f0", icon: "\u2022", color: "#475569" };
        default:
            return { bg: "#f8fafc", border: "#e2e8f0", icon: "\u2022", color: "#475569" };
    }
}

function formatTimestamp(ts: string): string {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch {
        return ts;
    }
}

export default function ClarificationThread({ workNotes, statusNotes, questionAuthor, isExternal = false, excludeQuestion = false }: ClarificationThreadProps) {
    const entries = getClarificationThread({ workNotes, statusNotes, questionAuthor, isExternal });

    const visibleEntries = isExternal
        ? entries.filter(e => e.audience === "External" || e.type === "External Partner Response")
        : excludeQuestion
            ? entries.filter(e => e.type !== "Contributor Question")
            : entries;

    if (visibleEntries.length === 0) {
        return (
            <div style={{ padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc", fontSize: 13, color: "#475569" }}>
                No clarification thread entries yet.
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleEntries.map((entry) => {
                const style = getEntryStyle(entry.type);
                return (
                    <div
                        key={entry.id}
                        style={{
                            padding: "10px 12px",
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            borderRadius: 8,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: style.border,
                                color: style.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 700,
                            }}>
                                {style.icon}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: style.color }}>{entry.type}</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>\u2022</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>{entry.author}</span>
                            {entry.timestamp && (
                                <>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>\u2022</span>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>{formatTimestamp(entry.timestamp)}</span>
                                </>
                            )}
                            <span style={{
                                marginLeft: "auto",
                                fontSize: 10,
                                fontWeight: 600,
                                color: entry.audience === "External" ? "#0369a1" : "#475569",
                                padding: "2px 6px",
                                background: entry.audience === "External" ? "#f0f9ff" : "#f1f5f9",
                                borderRadius: 4,
                            }}>
                                {entry.audience}
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap", marginLeft: 26 }}>
                            {entry.message}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
