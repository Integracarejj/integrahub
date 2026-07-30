import { describe, it, expect, beforeEach } from 'vitest';
import { diag, clearDiag, getDiagBuffer, diagRequestState, compareRequests, evaluateExternalSelector } from '../utils/diagnostics';
import type { RecapRequest } from '../services/recapMockData';
import { getExternalStatusInfo } from '../services/externalStatusMapping';
import { toExternalStatusInput } from '../services/portalMockData';

const store: Record<string, string> = {};

const localStorageMock: Storage = {
    get length() { return Object.keys(store).length; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    getItem(key: string) { return store[key] ?? null; },
    key(index: number) { return Object.keys(store)[index] ?? null; },
    removeItem(key: string) { delete store[key]; },
    setItem(key: string, value: string) { store[key] = value; },
};

globalThis.localStorage = localStorageMock;

// Using type only for local mocks — actual service imports below
import type { PortalRequest } from '../services/portalMockData';

import {
    setActivePersona,
    getPortalRequests,
    submitBrokerUploadPackage,
    confirmBrokerPackage,
    createPortalTransaction,
    getAggregateTransactionStats,
    saveParsedRows,
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getRequests,
    getRequestById,
    updateRequestStatus,
    blockRequest,
    resolveBlockerInternal,
    updateRequestCompletion,
    updateRequestExternalStatus,
    submitClarificationToDdOperations,
    returnClarificationToContributor,
    updateRequestReturnToOwner,
    archiveRequest,
    publishSelectedRequests,
    patchRequest,
    isRecapWiped,
    isDemoLoaded,
    getPortalCreatedRequests,
    partnerReworkRequest,
    addActivityEntry,
    addWorkNote,
} from '../services/recapDataService';

/* ── Reproduce the exact UI event handlers ───────────────── */

function uiAcceptWork(reqId: string, currentUser: string, title: string, category: string, transactionId: string, transactionName: string): void {
    updateRequestStatus(reqId, 'In Progress');
    addActivityEntry({
        type: 'Status Change',
        description: `Status changed to In Progress`,
        userId: 'current-user',
        userName: currentUser,
        requestId: reqId,
        requestTitle: title || category || '',
        transactionId,
        transactionName: transactionName || transactionId,
    });
}

function uiBlockWork(reqId: string, reason: string, currentUser: string): void {
    blockRequest(reqId, reason, currentUser);
}

function uiResolveBlocker(reqId: string, guidance: string, currentUser: string): void {
    resolveBlockerInternal(reqId, guidance, currentUser);
}

function uiCompleteReview(reqId: string, currentUser: string, note: string, title: string, category: string, transactionId: string, transactionName: string): void {
    const now = new Date().toISOString().split('T')[0];
    updateRequestCompletion(reqId, {
        completedBy: currentUser,
        completedAt: now,
        completionNotes: note,
    });
    if (note) {
        addWorkNote(reqId, note, currentUser, 'Completed');
    }
    addActivityEntry({
        type: 'Status Change',
        description: `Marked as Complete. Notes: ${note || 'none provided'}`,
        userId: 'current-user',
        userName: currentUser,
        requestId: reqId,
        requestTitle: title || category || '',
        transactionId,
        transactionName: transactionName || transactionId,
    });
}

function uiPublishExternal(reqId: string, currentUser: string, title: string, category: string, transactionId: string, transactionName: string, displayId: string): void {
    updateRequestExternalStatus(reqId, false, undefined, []);
    addActivityEntry({
        type: 'Status Change',
        description: `${displayId}: Published externally by ${currentUser}`,
        userId: 'current-user',
        userName: currentUser,
        requestId: reqId,
        requestTitle: title || category || '',
        transactionId,
        transactionName: transactionName || transactionId,
    });
}

/* ── Setup ────────────────────────────────────────────────── */

const CONTRIBUTOR = 'Sarah Chen';
const DD_OPS_LEAD = 'David Park';

function setupPortalProject(): { txnId: string; submissionId: string } {
    clearDiag();
    clearAllPortalCreatedData();
    setActivePersona('broker');
    const txnId = createPortalTransaction('Publication Repair Test');
    setActivePersona('broker');
    const rows = [
        { 'Request Title': 'Simple Path Request', 'Category': 'Financial', 'Priority': 'High', '#': '1' },
        { 'Request Title': 'Blocker Path Request', 'Category': 'Legal', 'Priority': 'High', '#': '2' },
        { 'Request Title': 'Clarification Path Request', 'Category': 'Environmental', 'Priority': 'Medium', '#': '3' },
        { 'Request Title': 'Not Applicable Path Request', 'Category': 'Regulatory', 'Priority': 'Low', '#': '4' },
    ];
    saveParsedRows(rows);
    const result = submitBrokerUploadPackage('test_package.xlsx', 4, ['Financial', 'Legal', 'Environmental', 'Regulatory'], txnId);
    confirmBrokerPackage(result.submissionId);
    return { txnId, submissionId: result.submissionId };
}

function getRequestByTitle(txnId: string, titlePart: string): RecapRequest | undefined {
    return getRequests().find(r =>
        r.transactionId === txnId && r.title?.toLowerCase().includes(titlePart.toLowerCase())
    );
}

/* ── Tests ────────────────────────────────────────────────── */

describe('Workflow Publication Repair', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        clearDiag();
        clearAllPortalCreatedData();
    });

    describe('Test 1 — Simple path (control)', () => {
        it('should appear externally after Accept → Complete → Publish', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'simple');
            if (!req) throw new Error('Simple request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });

            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            diagRequestState('simple after publish', getRequestById(req.id));

            const portalReqs = getPortalRequests();
            const found = portalReqs.find(r => r.id === req.id || r.requestId === req.id);
            expect(found).toBeDefined();
            expect(found?._rawStatus).toBe('Waiting Partner Review');
            expect(found?.externalStatus).toBe('Published External');
            const ext = getExternalStatusInfo(toExternalStatusInput(found!));
            expect(ext.status).toBe('Awaiting Your Review');
        });
    });

    describe('Test 2 — Blocker path', () => {
        it('should appear externally after Accept → Blocker → Resolve → Return → Re-accept → Complete → Publish', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'blocker');
            if (!req) throw new Error('Blocker request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });

            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiBlockWork(req.id, 'Missing documents', CONTRIBUTOR);

            uiResolveBlocker(req.id, 'Documents received', DD_OPS_LEAD);

            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            diagRequestState('blocker after publish', getRequestById(req.id));

            const portalReqs = getPortalRequests();
            const found = portalReqs.find(r => r.id === req.id || r.requestId === req.id);
            expect(found).toBeDefined();
            expect(found?._rawStatus).toBe('Waiting Partner Review');
            expect(found?.externalStatus).toBe('Published External');
            const ext = getExternalStatusInfo(toExternalStatusInput(found!));
            expect(ext.status).toBe('Awaiting Your Review');
        });
    });

    describe('Test 3 — Rework path', () => {
        it('should appear externally once (not duplicated) after Publish → Rework → Republish', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'simple');
            if (!req) throw new Error('Rework request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });

            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            const reqBeforeRework = getRequestById(req.id);
            if (!reqBeforeRework) throw new Error('Request lost after first publish');

            partnerReworkRequest(req.id, 'Please revise the financial section');

            updateRequestStatus(req.id, 'Needs Rework');
            updateRequestReturnToOwner(req.id, 'Revise financials', DD_OPS_LEAD);

            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            diagRequestState('rework after republish', getRequestById(req.id));

            const portalReqs = getPortalRequests();
            const found = portalReqs.filter(r => r.id === req.id || r.requestId === req.id);
            expect(found.length).toBe(1);
            expect(found[0].externalStatus).toBe('Published External');
            const ext = getExternalStatusInfo(toExternalStatusInput(found[0]));
            expect(ext.status).toBe('Awaiting Your Review');
        });
    });

    describe('Four-path field comparison', () => {
        it('should capture field-by-field state for all four publication paths', () => {
            const { txnId, submissionId } = setupPortalProject();

            const simpleReq = getRequestByTitle(txnId, 'simple')!;
            publishSelectedRequests([simpleReq.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(simpleReq.id, CONTRIBUTOR, simpleReq.title || '', simpleReq.category || '', simpleReq.transactionId, simpleReq.transactionName || '');
            uiCompleteReview(simpleReq.id, CONTRIBUTOR, '', simpleReq.title || '', simpleReq.category || '', simpleReq.transactionId, simpleReq.transactionName || '');
            uiPublishExternal(simpleReq.id, DD_OPS_LEAD, simpleReq.title || '', simpleReq.category || '', simpleReq.transactionId, simpleReq.transactionName || '', simpleReq.requestId);
            const simpleFinal = getRequestById(simpleReq.id);
            diagRequestState('SIMPLE final', simpleFinal);

            const blockerReq = getRequestByTitle(txnId, 'blocker')!;
            publishSelectedRequests([blockerReq.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(blockerReq.id, CONTRIBUTOR, blockerReq.title || '', blockerReq.category || '', blockerReq.transactionId, blockerReq.transactionName || '');
            uiBlockWork(blockerReq.id, 'Issue', CONTRIBUTOR);
            uiResolveBlocker(blockerReq.id, 'Fixed', DD_OPS_LEAD);
            uiAcceptWork(blockerReq.id, CONTRIBUTOR, blockerReq.title || '', blockerReq.category || '', blockerReq.transactionId, blockerReq.transactionName || '');
            uiCompleteReview(blockerReq.id, CONTRIBUTOR, '', blockerReq.title || '', blockerReq.category || '', blockerReq.transactionId, blockerReq.transactionName || '');
            uiPublishExternal(blockerReq.id, DD_OPS_LEAD, blockerReq.title || '', blockerReq.category || '', blockerReq.transactionId, blockerReq.transactionName || '', blockerReq.requestId);
            const blockerFinal = getRequestById(blockerReq.id);
            diagRequestState('BLOCKER final', blockerFinal);

            const clarReq = getRequestByTitle(txnId, 'clarification')!;
            publishSelectedRequests([clarReq.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(clarReq.id, CONTRIBUTOR, clarReq.title || '', clarReq.category || '', clarReq.transactionId, clarReq.transactionName || '');
            submitClarificationToDdOperations(clarReq.id, 'Need more details', null, CONTRIBUTOR);
            returnClarificationToContributor(clarReq.id, 'Response provided', DD_OPS_LEAD);
            uiAcceptWork(clarReq.id, CONTRIBUTOR, clarReq.title || '', clarReq.category || '', clarReq.transactionId, clarReq.transactionName || '');
            uiCompleteReview(clarReq.id, CONTRIBUTOR, '', clarReq.title || '', clarReq.category || '', clarReq.transactionId, clarReq.transactionName || '');
            uiPublishExternal(clarReq.id, DD_OPS_LEAD, clarReq.title || '', clarReq.category || '', clarReq.transactionId, clarReq.transactionName || '', clarReq.requestId);
            const clarFinal = getRequestById(clarReq.id);
            diagRequestState('CLARIFICATION final', clarFinal);

            const naReq = getRequestByTitle(txnId, 'not applicable')!;
            publishSelectedRequests([naReq.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(naReq.id, CONTRIBUTOR, naReq.title || '', naReq.category || '', naReq.transactionId, naReq.transactionName || '');
            archiveRequest(naReq.id, 'Not Applicable', 'Item not applicable to this transaction', DD_OPS_LEAD);
            const naFinal = getRequestById(naReq.id);
            diagRequestState('NOT APPLICABLE final', naFinal);

            const compareFields = [
                'id', 'requestId', 'transactionId', 'orgId',
                'status', '_externalStatus', '_publishedExternal', '_publishedAt',
                '_blockerStatus', '_blockerResolution', '_returnReason', '_returnedBy',
                '_completedBy', '_completedAt', '_partnerDecision',
                '_exceptionRecommendation', '_exceptionSentAt', '_exceptionDecision',
                '_processingStartedAt', '_needsReassignment', '_misassignedReason',
                'owner', 'assignedTo', '_archived', '_archiveReason',
            ];
            const comparison = compareRequests(
                simpleFinal as any, blockerFinal as any, clarFinal as any, naFinal as any,
                compareFields,
            );

            const differing = comparison.filter(c => c.differs);
            for (const d of differing) {
                diag('WORKFLOW_STEP', `FIELD DIFFERENCE: ${d.field}`, d as any);
            }

            const allPortalReqs = getPortalRequests();
            const stats = getAggregateTransactionStats();

            for (const req of allPortalReqs) {
                const ext = getExternalStatusInfo(toExternalStatusInput(req));
                diag('REQUEST_STATE_SNAPSHOT', `Portal request ${req.requestId || req.id}`, {
                    requestId: req.requestId,
                    id: req.id,
                    _rawStatus: req._rawStatus,
                    status: req.status,
                    externalStatus: req.externalStatus,
                    _publishedExternal: req._publishedExternal,
                    transactionId: req.transactionId,
                    orgId: req.orgId,
                    derivedExtStatus: ext.status,
                    derivedExtLabel: ext.label,
                });
            }

            const allReqs = getRequests();
            diag('WORKFLOW_STEP', 'Aggregate stats', {
                totalRequests: stats.totalRequests,
                byStatus: stats.byStatus,
                transactionCount: stats.transactionCount,
                totalInGetRequests: allReqs.length,
                portalRequestsInGetPortalRequests: allPortalReqs.length,
            });

            expect(getDiagBuffer().length).toBeGreaterThan(0);
            console.log('=== DIAGNOSTICS BUFFER ===');
            for (const event of getDiagBuffer()) {
                console.log(JSON.stringify(event, null, 2));
            }
        });
    });
});
