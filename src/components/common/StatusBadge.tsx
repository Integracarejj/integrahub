const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon?: string }> = {
  "Open": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  "Assigned": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  "In Progress": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "Clarification Needed": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "Blocked": { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  "Duplicate": { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  "Not Applicable": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  "Needs DD Review": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  "Ready to Publish": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  "Waiting Partner Decision": { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  "Partner Action": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "Completed": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  "Complete": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  "Archived": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  "Overdue": { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  "Needs Rework": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  "Waiting Review": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  "Approved": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  "Rework Required": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  "Published External": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  "Internal Only": { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
  "Closed": { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
  "Possible Duplicate": { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  "Not Applicable Review": { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  "Exception Review": { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  "Action Needed": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  "Clarification Requested": { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  "Waiting for DD Operations": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES["Internal Only"];
    return (
        <span className={className} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 26,
            padding: "0 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            background: style.bg,
            color: style.text,
            border: `1px solid ${style.border}`,
            whiteSpace: "nowrap",
            lineHeight: "26px",
        }}>
            {status}
        </span>
    );
}
