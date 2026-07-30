export default function ProjectBadge({ name }: { name?: string | null }) {
    if (!name) return <span style={{ color: "#94a3b8", fontSize: 12 }}>{"\u2014"}</span>;
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            background: "#eef2ff",
            color: "#4338ca",
            border: "1px solid #c7d2fe",
            lineHeight: "20px",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
        }}>
            {name}
        </span>
    );
}
