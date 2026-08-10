import { describe, it, expect, beforeEach } from 'vitest';
import { clearDiag, diagRequestState } from '../utils/diagnostics';
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

import {
    setActivePersona,
    getPortalRequests,
    submitBrokerUploadPackage,
    confirmBrokerPackage,
    createPortalTransaction,
    saveParsedRows,
} from '../services/portalMockData';

import {
    clearAllPortalCreatedData,
    getRequests,
    getRequestById,
    updateRequestOwner,
    updateRequestStatus,
    blockRequest,
    resolveBlockerInternal,
    updateRequestCompletion,
    updateRequestExternalStatus,
    submitClarificationToDdOperations,
    returnClarificationToContributor,
    publishSelectedRequests,
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

const JAMES = 'James Wright';
const SECOND = 'Anna Patel';
const FALLBACK = 'Sarah Chen';
const DD_OPS_LEAD = 'David Park';

function setupPortalProject(): { txnId: string; submissionId: string } {
    clearDiag();
    clearAllPortalCreatedData();
    setActivePersona('broker');
    const txnId = createPortalTransaction('Ownership Preservation Test');
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

describe('Clarification Ownership Preservation', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        clearDiag();
        clearAllPortalCreatedData();
    });

    describe('Regression core — UI identity fallback must not steal return routing', () => {
        it('clarify→return routes to the request owner (James Wright), not the fallback identity (Sarah Chen)', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'clarification');
            if (!req) throw new Error('Clarification request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            updateRequestOwner(req.id, JAMES);
            expect(getRequestById(req.id)?.owner).toBe(JAMES);

            const clar = submitClarificationToDdOperations(req.id, 'Need more details', null, FALLBACK);
            expect(clar).toBeDefined();
            expect(clar!.status).toBe('Clarification Needed');
            expect(clar!._clarificationRaisedBy).toBe(JAMES);
            expect(clar!._clarificationRaisedBy).not.toBe(FALLBACK);
            expect(clar!.owner).toBe(DD_OPS_LEAD);
            expect(clar!.assignedTo).toBe(DD_OPS_LEAD);
            expect(clar!._workNotes?.some(n => n.author === FALLBACK)).toBe(true);

            const returned = returnClarificationToContributor(req.id, 'Response provided', DD_OPS_LEAD);
            expect(returned).toBeDefined();
            expect(returned!.status).toBe('Needs Rework');
            expect(returned!.owner).toBe(JAMES);
            expect(returned!.assignedTo).toBe(JAMES);
            expect(returned!._clarificationRaisedBy).toBeNull();
        });
    });

    describe('Second contributor — invariant holds for any owner', () => {
        it('clarify→return routes to Anna Patel even when the fallback identity is passed', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'clarification');
            if (!req) throw new Error('Clarification request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            updateRequestOwner(req.id, SECOND);
            expect(getRequestById(req.id)?.owner).toBe(SECOND);

            const clar = submitClarificationToDdOperations(req.id, 'Need more details', null, FALLBACK);
            expect(clar!._clarificationRaisedBy).toBe(SECOND);
            expect(clar!._clarificationRaisedBy).not.toBe(FALLBACK);

            const returned = returnClarificationToContributor(req.id, 'Response provided', DD_OPS_LEAD);
            expect(returned!.owner).toBe(SECOND);
            expect(returned!.assignedTo).toBe(SECOND);
            expect(returned!._clarificationRaisedBy).toBeNull();
        });
    });

    describe('Blocker parallel — established invariant already preserves the owner', () => {
        it('block→resolve returns to James Wright, not the fallback identity', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'blocker');
            if (!req) throw new Error('Blocker request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            updateRequestOwner(req.id, JAMES);

            const blocked = blockRequest(req.id, 'Missing data', FALLBACK);
            expect(blocked).toBeDefined();
            expect(blocked!.status).toBe('Blocked');
            expect(blocked!._blockerRaisedBy).toBe(JAMES);
            expect(blocked!._blockerRaisedBy).not.toBe(FALLBACK);
            expect(blocked!.owner).toBe(DD_OPS_LEAD);

            const resolved = resolveBlockerInternal(req.id, 'Data received', DD_OPS_LEAD);
            expect(resolved).toBeDefined();
            expect(resolved!.status).toBe('Needs Rework');
            expect(resolved!.owner).toBe(JAMES);
            expect(resolved!.assignedTo).toBe(JAMES);
        });
    });

    describe('Fallbacks — no owner or DD Ops-owned request', () => {
        it('unassigned request falls back to the raiser as return target', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'clarification');
            if (!req) throw new Error('Clarification request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            expect(getRequestById(req.id)?.owner ?? null).toBeNull();

            const clar = submitClarificationToDdOperations(req.id, 'Question', null, SECOND);
            expect(clar!._clarificationRaisedBy).toBe(SECOND);

            const returned = returnClarificationToContributor(req.id, 'Answer', DD_OPS_LEAD);
            expect(returned!.owner).toBe(SECOND);
        });

        it('DD Ops-owned request falls back to the raiser as return target', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'clarification');
            if (!req) throw new Error('Clarification request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            updateRequestOwner(req.id, DD_OPS_LEAD);

            const clar = submitClarificationToDdOperations(req.id, 'Question', null, SECOND);
            expect(clar!._clarificationRaisedBy).toBe(SECOND);

            const returned = returnClarificationToContributor(req.id, 'Answer', DD_OPS_LEAD);
            expect(returned!.owner).toBe(SECOND);
        });
    });

    describe('End-to-end — clarification ownership flows through to publication', () => {
        it('James → clarify (fallback raiser) → return → re-accept → complete → publish → Awaiting Your Review', () => {
            const { txnId, submissionId } = setupPortalProject();
            const req = getRequestByTitle(txnId, 'clarification');
            if (!req) throw new Error('Clarification request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            updateRequestOwner(req.id, JAMES);

            submitClarificationToDdOperations(req.id, 'Need more details', null, FALLBACK);
            returnClarificationToContributor(req.id, 'Response provided', DD_OPS_LEAD);
            expect(getRequestById(req.id)?.owner).toBe(JAMES);

            uiAcceptWork(req.id, JAMES, req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiCompleteReview(req.id, JAMES, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            const final = getRequestById(req.id);
            diagRequestState('clarification-ownership after publish', final);
            expect(final?.status).toBe('Waiting Partner Review');
            expect(final?._externalStatus).toBe('Published External');
            expect(final?._publishedExternal).toBe(true);

            const portalReqs = getPortalRequests();
            const found = portalReqs.find(r => r.id === req.id || r.requestId === req.id);
            expect(found).toBeDefined();
            expect(found?._rawStatus).toBe('Waiting Partner Review');
            expect(found?.externalStatus).toBe('Published External');
            const ext = getExternalStatusInfo(toExternalStatusInput(found!));
            expect(ext.status).toBe('Awaiting Your Review');
        });
    });
});
