import type { WorkNoteEntry } from "../../services/recapMockData";

interface ClarificationThreadProps {
    workNotes: WorkNoteEntry[];
    statusNotes: string | null | undefined;
    questionAuthor?: string | null;
    isExternal?: boolean;
}

interface ThreadEntry {
    id: string;
    type: "Contributor Question" | "Contributor Context" | "DD Operations Guidance" | "External Question" | "External Partner Response" | "Internal Follow-up";
    author: string;
    timestamp: string;
    message: string;
    audience: "Internal" | "External";
}

function getClarificationThread({ workNotes, statusNotes, questionAuthor }: ClarificationThreadProps): ThreadEntry[] {
    const entries: ThreadEntry[] = [];
    
    // Add the original contributor question from statusNotes
    if (statusNotes) {
        entries.push({
            id: "question-original",
            type: "Contributor Question",
            author: questionAuthor || "Contributor",
            timestamp: "",
            message: statusNotes,
            audience: "Internal",
        });
    }
    
    // Process work notes
    if (workNotes) {
        for (const note of workNotes) {
            if (!note.action) continue;
            
            switch (note.action) {
                case "Clarification Needed":
                    // This is the original question being raised
                    entries.push({
                        id: note.id,
                        type: "Contributor Question",
                        author: note.author,
                        timestamp: note.timestamp,
                        message: note.text,
                        audience: "Internal",
                    });
                    break;
                case "Clarification Response":
                    // DD Operations response or external response
                    // Check if it's from external partner
                    if (note.author === "External Partner") {
                        entries.push({
                            id: note.id,
                            type: "External Partner Response",
                            author: note.author,
                            timestamp: note.timestamp,
                            message: note.text,
                            audience: "Internal",
                        });
                    } else {
                        entries.push({
                            id: note.id,
                            type: "DD Operations Guidance",
                            author: note.author,
                            timestamp: note.timestamp,
                            message: note.text,
                            audience: "Internal",
                        });
                    }
                    break;
                case "Clarification External Question":
                    entries.push({
                        id: note.id,
                        type: "External Question",
                        author: note.author,
                        timestamp: note.timestamp,
                        message: note.text,
                        audience: "External",
                    });
                    break;
                case "Clarification Guidance":
                    entries.push({
                        id: note.id,
                        type: "DD Operations Guidance",
                        author: note.author,
                        timestamp: note.timestamp,
                        message: note.text,
                        audience: "Internal",
                    });
                    break;
                case "Clarification Context":
                    entries.push({
                        id: note.id,
                        type: "Contributor Context",
                        author: note.author,
                        timestamp: note.timestamp,
                        message: note.text,
                        audience: "Internal",
                    });
                    break;
                default:
                    // Other work notes are internal follow-ups
                    if (note.text && note.action !== "Work Note") {
                        entries.push({
                            id: note.id,
                            type: "Internal Follow-up",
                            author: note.author,
                            timestamp: note.timestamp,
                            message: note.text,
                            audience: "Internal",
                        });
                    }
                    break;
            }
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
            return { bg: "#ecfeff", border: "#a5f3fc", icon: "→", color: "#0e7490" };
        case "External Question":
            return { bg: "#f0f9ff", border: "#bae6fd", icon: "✉", color: "#0369a1" };
        case "External Partner Response":
            return { bg: "#f0fdf4", border: "#bbf7d0", icon: "✓", color: "#166534" };
        case "Internal Follow-up":
            return { bg: "#f8fafc", border: "#e2e8f0", icon: "•", color: "#475569" };
        default:
            return { bg: "#f8fafc", border: "#e2e8f0", icon: "•", color: "#475569" };
    }
}

export default function ClarificationThread({ workNotes, statusNotes, questionAuthor, isExternal = false }: ClarificationThreadProps) {
    const entries = getClarificationThread({ workNotes, statusNotes, questionAuthor, isExternal });
    
    // Filter entries based on audience if external
    const visibleEntries = isExternal 
        ? entries.filter(e => e.audience === "External" || e.type === "External Partner Response")
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
                            <span style={{ fontSize: 11, color: "#64748b" }}>•</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>{entry.author}</span>
                            {entry.timestamp && (
                                <>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>•</span>
                                    <span style={{ fontSize: 11, color: "#64748b" }}>{entry.timestamp}</span>
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
