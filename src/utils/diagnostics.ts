type DiagEventType =
  | "WORKFLOW_STEP"
  | "PUBLISH_EXTERNAL_CALLED"
  | "EXTERNAL_REQUEST_SELECTOR_EVALUATED"
  | "EXTERNAL_REQUEST_INCLUDED"
  | "EXTERNAL_REQUEST_EXCLUDED"
  | "REQUEST_STATE_SNAPSHOT";

interface DiagEvent {
  timestamp: string;
  type: DiagEventType;
  label: string;
  data: Record<string, unknown>;
}

const buffer: DiagEvent[] = [];

export function diag(type: DiagEventType, label: string, data: Record<string, unknown> = {}): void {
  buffer.push({ timestamp: new Date().toISOString(), type, label, data });
}

export function getDiagBuffer(): readonly DiagEvent[] {
  return buffer;
}

export function clearDiag(): void {
  buffer.length = 0;
}

export function diagRequestState(label: string, req: Record<string, unknown> | null | undefined): void {
  if (!req) {
    diag("REQUEST_STATE_SNAPSHOT", label, { error: "request not found" });
    return;
  }
  diag("REQUEST_STATE_SNAPSHOT", label, {
    id: req.id,
    requestId: req.requestId,
    intakeId: req.intakeId,
    orgId: req.orgId,
    transactionId: req.transactionId,
    project: req.project,
    status: req.status,
    _externalStatus: req._externalStatus,
    _publishedExternal: req._publishedExternal,
    _publishedAt: req._publishedAt,
    _blockerStatus: req._blockerStatus,
    _blockerReason: req._blockerReason,
    _blockerResolution: req._blockerResolution,
    _returnReason: req._returnReason,
    _returnedBy: req._returnedBy,
    _completedBy: req._completedBy,
    _completedAt: req._completedAt,
    _partnerDecision: req._partnerDecision,
    _exceptionRecommendation: req._exceptionRecommendation,
    _exceptionSentAt: req._exceptionSentAt,
    _exceptionDecision: req._exceptionDecision,
    _processingStartedAt: req._processingStartedAt,
    _needsReassignment: req._needsReassignment,
    _misassignedReason: req._misassignedReason,
    owner: req.owner,
    assignedTo: req.assignedTo,
    _clarificationStatus: req._clarificationStatus,
    _clarificationSentAt: req._clarificationSentAt,
    _clarificationExternalSentAt: req._clarificationExternalSentAt,
  });
}

export interface FieldComparison {
  field: string;
  simple: unknown;
  blocker: unknown;
  clarification: unknown;
  notApplicable: unknown;
  differs: boolean;
}

export function compareRequests(
  simple: Record<string, unknown> | null,
  blocker: Record<string, unknown> | null,
  clarification: Record<string, unknown> | null,
  notApplicable: Record<string, unknown> | null,
  fields: string[],
): FieldComparison[] {
  return fields.map(field => {
    const simpleVal = simple?.[field] ?? null;
    const blockerVal = blocker?.[field] ?? null;
    const clarVal = clarification?.[field] ?? null;
    const naVal = notApplicable?.[field] ?? null;
    const allSame = simpleVal === blockerVal && blockerVal === clarVal && clarVal === naVal;
    return { field, simple: simpleVal, blocker: blockerVal, clarification: clarVal, notApplicable: naVal, differs: !allSame };
  });
}

export function evaluateExternalSelector(req: Record<string, unknown> | null | undefined, identity: { authorizedTxnIds: string[]; orgId: string } | null): void {
  if (!req) {
    diag("EXTERNAL_REQUEST_SELECTOR_EVALUATED", "no request provided", { excluded: true, reason: "request is null/undefined" });
    return;
  }
  if (!identity) {
    diag("EXTERNAL_REQUEST_EXCLUDED", "no persona identity", { id: req.id, requestId: req.requestId, excluded: true, reason: "getPersonaIdentity() returned null" });
    return;
  }

  const txnId = req.transactionId as string | undefined;
  const orgId = req.orgId as string | undefined;

  if (!txnId) {
    diag("EXTERNAL_REQUEST_EXCLUDED", "missing transactionId", { id: req.id, requestId: req.requestId, excluded: true, reason: "request has no transactionId" });
    return;
  }

  const isAuthorizedTxn = identity.authorizedTxnIds.includes(txnId);
  if (!isAuthorizedTxn) {
    diag("EXTERNAL_REQUEST_EXCLUDED", "unauthorized transaction", { id: req.id, requestId: req.requestId, transactionId: txnId, authorizedTxnIds: identity.authorizedTxnIds, excluded: true, reason: `transactionId "${txnId}" not in authorized transactions` });
    return;
  }

  if (orgId && orgId !== identity.orgId) {
    diag("EXTERNAL_REQUEST_EXCLUDED", "org mismatch", { id: req.id, requestId: req.requestId, orgId, expectedOrgId: identity.orgId, excluded: true, reason: `orgId "${orgId}" does not match identity org "${identity.orgId}"` });
    return;
  }

  const isDemo = isDemoTxn(txnId);
  if (isDemo) {
    diag("EXTERNAL_REQUEST_EXCLUDED", "demo transaction", { id: req.id, requestId: req.requestId, transactionId: txnId, excluded: true, reason: `transactionId "${txnId}" is a demo transaction` });
    return;
  }

  diag("EXTERNAL_REQUEST_INCLUDED", "request passes selector", { id: req.id, requestId: req.requestId, transactionId: txnId, orgId });
}

function isDemoTxn(txnId: string): boolean {
  const DEMO_TXNS = new Set(["txn-abc-portfolio", "txn-harbor-deal", "txn-summit-review"]);
  return DEMO_TXNS.has(txnId);
}
