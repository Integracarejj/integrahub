const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    "Low": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
    "Medium": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    "High": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
    "Critical": { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

export function PriorityBadge({ priority }: { priority: string }) {
    const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES["Medium"];
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 24,
            padding: "0 12px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            background: style.bg,
            color: style.text,
            border: `1px solid ${style.border}`,
            whiteSpace: "nowrap",
            lineHeight: "24px",
        }}>
            {priority}
        </span>
    );
}
