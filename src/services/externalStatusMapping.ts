export type ExternalStatus =
  | "Submitted"
  | "Under Review"
  | "Information Requested"
  | "Awaiting Your Review"
  | "Exception Review"
  | "Complete";

export interface ExternalStatusInfo {
  status: ExternalStatus;
  label: string;
  description: string;
  nextActionOwner: "IntegraCare" | "External Partner" | "None — Complete";
  externalActionRequired: boolean;
  externalActionLabel: string | null;
  isTerminal: boolean;
  completionMessage: string | null;
}

function getRecapStatus(req: { status: string; _exceptionRecommendation?: string | null; _exceptionDecision?: string | null; _publishedExternal?: boolean; _externalStatus?: string | null; _exceptionSentAt?: string | null; _publishedAt?: string | null; _workNotes?: Array<{ action?: string | null }> | null }): string {
    const status = req.status;
    const exceptionRec = req._exceptionRecommendation;
    const exceptionDec = req._exceptionDecision;
    const exceptionSent = req._exceptionSentAt;
    const publishedExt = req._publishedExternal || req._externalStatus === "Published External";
    const publishedAt = req._publishedAt;

    if (status === "Completed" || status === "Rejected") return "terminal-complete";
    if (status === "Closed" || status === "Closed / Duplicate" || status === "Closed / Not Applicable") return "terminal-complete";
    if (exceptionDec) return "terminal-complete";
    if (status === "Duplicate" || status === "Not Applicable") {
        if (exceptionSent) return "exception-review";
        return "under-review";
    }
    if (exceptionRec && !exceptionDec && status !== "Clarification Needed") {
        return exceptionSent ? "exception-review" : "under-review";
    }
    if (status === "Clarification Needed") {
        const notes = req._workNotes;
        if (notes && notes.length > 0) {
            const hasExternalQuestion = notes.some((n: { action?: string | null }) => n.action === "Clarification External Question");
            if (hasExternalQuestion) {
                const clarActions = ["Clarification External Question", "Clarification Response", "Clarification Guidance"];
                const clarNotes = notes.filter((n: { action?: string | null }) => clarActions.includes(n.action || ""));
                if (clarNotes.length > 0) {
                    const lastAction = clarNotes[clarNotes.length - 1].action;
                    if (lastAction === "Clarification External Question") return "information-requested";
                    if (lastAction === "Clarification Response") return "under-review";
                }
                return "information-requested";
            }
        }
        if (notes?.some((n: { action?: string | null }) => n.action === "Clarification Response")) return "under-review";
        return "information-requested";
    }
    if (req._externalStatus === "Published External" || publishedExt) {
        if (status === "Needs Rework") return "under-review";
        if (status === "Completed") return "terminal-complete";
        return "awaiting-your-review";
    }
    if (status === "Complete") return "under-review";
    if (status === "In Progress" || status === "Open" || status === "Assigned") return "under-review";
    if (status === "Needs Rework") return "under-review";
    if (status === "Blocked") return "under-review";
    if (publishedAt && !publishedExt) return "under-review";
    return "submitted";
}

const STATUS_INFO: Record<string, ExternalStatusInfo> = {
  "submitted": {
    status: "Submitted",
    label: "Submitted",
    description: "IntegraCare received this request and is completing its initial review.",
    nextActionOwner: "IntegraCare",
    externalActionRequired: false,
    externalActionLabel: null,
    isTerminal: false,
    completionMessage: null,
  },
  "under-review": {
    status: "Under Review",
    label: "Under Review",
    description: "IntegraCare is reviewing and processing this request.",
    nextActionOwner: "IntegraCare",
    externalActionRequired: false,
    externalActionLabel: null,
    isTerminal: false,
    completionMessage: null,
  },
  "information-requested": {
    status: "Information Requested",
    label: "Information Requested",
    description: "IntegraCare needs additional information from you to continue processing this request.",
    nextActionOwner: "External Partner",
    externalActionRequired: true,
    externalActionLabel: "Respond",
    isTerminal: false,
    completionMessage: null,
  },
  "awaiting-your-review": {
    status: "Awaiting Your Review",
    label: "Awaiting Your Review",
    description: "Documents are ready for your review. Please review the published materials and approve or request rework.",
    nextActionOwner: "External Partner",
    externalActionRequired: true,
    externalActionLabel: "Review Documents",
    isTerminal: false,
    completionMessage: null,
  },
  "exception-review": {
    status: "Exception Review",
    label: "Exception Review",
    description: "IntegraCare has identified a potential exception. Review the recommendation and choose an outcome.",
    nextActionOwner: "External Partner",
    externalActionRequired: true,
    externalActionLabel: "Review Recommendation",
    isTerminal: false,
    completionMessage: null,
  },
  "terminal-complete": {
    status: "Complete",
    label: "Complete",
    description: "Your review is complete. No further action is required.",
    nextActionOwner: "None — Complete",
    externalActionRequired: false,
    externalActionLabel: null,
    isTerminal: true,
    completionMessage: "You approved this request. The IntegraCare team has been notified of your decision. No further action is required. This request will remain available in your request history for future reference.",
  },
};

export function getExternalStatusInfo(req: { status: string; _exceptionRecommendation?: string | null; _exceptionDecision?: string | null; _publishedExternal?: boolean; _externalStatus?: string | null; _exceptionSentAt?: string | null; _publishedAt?: string | null; _workNotes?: Array<{ action?: string | null }> | null }): ExternalStatusInfo {
  const key = getRecapStatus(req);
  return STATUS_INFO[key] || STATUS_INFO["submitted"];
}

export function getExceptionContext(req: { _exceptionRecommendation?: string | null; _exceptionDecision?: string | null; _exceptionReason?: string | null; _statusNotes?: string | null }): { recommendationType: string | null; contextLabel: string | null; contextDescription: string | null } {
  const rec = req._exceptionRecommendation;
  const reason = req._exceptionReason || req._statusNotes;
  if (rec === "Duplicate") {
    return {
      recommendationType: "Duplicate",
      contextLabel: "Duplicate decision required",
      contextDescription: reason ? `Reason: ${reason}` : null,
    };
  }
  if (rec === "Not Applicable") {
    return {
      recommendationType: "Not Applicable",
      contextLabel: "Not Applicable decision required",
      contextDescription: reason ? `Reason: ${reason}` : null,
    };
  }
  return { recommendationType: null, contextLabel: null, contextDescription: null };
}

export const STATUS_PILL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Submitted": { bg: "#ffffff", text: "#0f172a", border: "#93c5fd" },
  "Under Review": { bg: "#ffffff", text: "#0f172a", border: "#67e8f9" },
  "Information Requested": { bg: "#ffffff", text: "#0f172a", border: "#fcd34d" },
  "Awaiting Your Review": { bg: "#ffffff", text: "#0f172a", border: "#6ee7b7" },
  "Exception Review": { bg: "#ffffff", text: "#0f172a", border: "#c4b5fd" },
  "Complete": { bg: "#ffffff", text: "#0f172a", border: "#86efac" },
  "Blocked": { bg: "#ffffff", text: "#0f172a", border: "#fca5a5" },
  "Duplicate": { bg: "#ffffff", text: "#0f172a", border: "#c4b5fd" },
  "Not Applicable": { bg: "#ffffff", text: "#0f172a", border: "#fcd34d" },
};

export function getStatusPillStyle(label: string): { bg: string; text: string; border: string } {
  return STATUS_PILL_STYLES[label] || STATUS_PILL_STYLES["Under Review"];
}
