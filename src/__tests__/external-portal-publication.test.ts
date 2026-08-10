import { describe, it, expect, beforeEach } from 'vitest';
import { clearDiag, getDiagBuffer, diagRequestState } from '../utils/diagnostics';
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
    publishSelectedRequests,
    addActivityEntry,
    addWorkNote,
} from '../services/recapDataService';

/* ── Reproduce the exact UI event handlers ───────────────── */

function uiAcceptWork(reqId: string, currentUser: string, title: string, category: string, transactionId: string, transactionName: string): void {
    updateRequestStatus(reqId, 'In Progress');
    addActivityEntry({
        type: 'Status Change',
        description: 'Status changed to In Progress',
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

function createProject(txnName: string, rows: { 'Request Title': string; 'Category': string; 'Priority': string; '#': string }[]): { txnId: string; submissionId: string } {
    const txnId = createPortalTransaction(txnName);
    saveParsedRows(rows);
    const result = submitBrokerUploadPackage('test_package.xlsx', rows.length, [...new Set(rows.map(r => r.Category))], txnId);
    confirmBrokerPackage(result.submissionId);
    return { txnId, submissionId: result.submissionId };
}

function setupProject(txnName: string, rows: { 'Request Title': string; 'Category': string; 'Priority': string; '#': string }[]): { txnId: string; submissionId: string } {
    clearDiag();
    clearAllPortalCreatedData();
    setActivePersona('broker');
    return createProject(txnName, rows);
}

function getRequestByTitle(txnId: string, titlePart: string): RecapRequest | undefined {
    return getRequests().find(r =>
        r.transactionId === txnId && r.title?.toLowerCase().includes(titlePart.toLowerCase())
    );
}

function projected(req: RecapRequest | undefined) {
    const portalReqs = getPortalRequests();
    return portalReqs.find(r => r.id === req?.id || r.requestId === req?.id);
}

/* ── Tests ────────────────────────────────────────────────── */

describe('External Portal Publication Boundary', () => {
    beforeEach(() => {
        Object.keys(store).forEach(k => delete store[k]);
        clearDiag();
        clearAllPortalCreatedData();
    });

    describe('TEST 1 — Simple publication', () => {
        it('shows Awaiting Your Review externally and emits publish diagnostics', () => {
            const { txnId, submissionId } = setupProject('Project Keystone', [
                { 'Request Title': 'Simple Path Request', 'Category': 'Financial', 'Priority': 'High', '#': '1' },
            ]);
            const req = getRequestByTitle(txnId, 'simple');
            if (!req) throw new Error('Simple request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            const canonical = getRequestById(req.id);
            expect(canonical?.status).toBe('Waiting Partner Review');
            expect(canonical?._externalStatus).toBe('Published External');

            const portalReq = projected(canonical);
            expect(portalReq).toBeDefined();
            expect(portalReq?._rawStatus).toBe('Waiting Partner Review');
            expect(portalReq?.externalStatus).toBe('Published External');
            expect(getExternalStatusInfo(toExternalStatusInput(portalReq!)).status).toBe('Awaiting Your Review');

            const types = getDiagBuffer().map(e => e.type);
            expect(types).toContain('PUBLISH_EXTERNAL_CALLED');
            expect(types).toContain('PUBLISH_CANONICAL_UPDATED');
            expect(types).toContain('PUBLISH_EXTERNAL_PROJECTION_UPDATED');
            expect(types).toContain('EXTERNAL_REQUEST_INCLUDED');
        });
    });

    describe('TEST 2 — Blocker history publication', () => {
        it('shows Awaiting Your Review externally after Blocker → Resolve → Complete → Publish', () => {
            const { txnId, submissionId } = setupProject('Project Keystone', [
                { 'Request Title': 'Blocker Path Request', 'Category': 'Legal', 'Priority': 'High', '#': '1' },
            ]);
            const req = getRequestByTitle(txnId, 'blocker');
            if (!req) throw new Error('Blocker request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiBlockWork(req.id, 'Missing documents', CONTRIBUTOR);
            expect(getRequestById(req.id)?._blockerStatus).toBe('Raised');
            uiResolveBlocker(req.id, 'Documents received', DD_OPS_LEAD);
            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            const canonical = getRequestById(req.id);
            expect(canonical?.status).toBe('Waiting Partner Review');
            const blockerHistory = canonical?._workNotes?.filter(n => n.action === 'Blocked' || n.action === 'Blocker Resolution');
            expect(blockerHistory?.length).toBeGreaterThanOrEqual(2);

            const portalReq = projected(canonical);
            expect(portalReq).toBeDefined();
            expect(getExternalStatusInfo(toExternalStatusInput(portalReq!)).status).toBe('Awaiting Your Review');
        });
    });

    describe('TEST 3 — Clarification history publication', () => {
        it('shows Awaiting Your Review externally after clarification history → Complete → Publish', () => {
            const { txnId, submissionId } = setupProject('Project Keystone', [
                { 'Request Title': 'Clarification Path Request', 'Category': 'Environmental', 'Priority': 'Medium', '#': '1' },
            ]);
            const req = getRequestByTitle(txnId, 'clarification');
            if (!req) throw new Error('Clarification request not found');

            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            submitClarificationToDdOperations(req.id, 'Need more details', null, CONTRIBUTOR);
            expect(getRequestById(req.id)?.status).toBe('Clarification Needed');
            returnClarificationToContributor(req.id, 'Response provided', DD_OPS_LEAD);
            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiPublishExternal(req.id, DD_OPS_LEAD, req.title || '', req.category || '', req.transactionId, req.transactionName || '', req.requestId);

            const canonical = getRequestById(req.id);
            expect(canonical?.status).toBe('Waiting Partner Review');

            const portalReq = projected(canonical);
            expect(portalReq).toBeDefined();
            const historicalClarNotes = canonical?._workNotes?.filter(n => n.action === 'Clarification Needed' || n.action === 'Clarification Response');
            expect(historicalClarNotes?.length).toBeGreaterThan(0);
            expect(getExternalStatusInfo(toExternalStatusInput(portalReq!)).status).toBe('Awaiting Your Review');
        });
    });

    describe('TEST 4 — Multi-project publication', () => {
        it('shows Awaiting Your Review for both projects with no duplicates, per-project filters work', () => {
            clearDiag();
            clearAllPortalCreatedData();
            setActivePersona('broker');

            const keystone = createProject('Project Keystone', [
                { 'Request Title': 'Keystone Alpha', 'Category': 'Financial', 'Priority': 'High', '#': '1' },
                { 'Request Title': 'Keystone Beta', 'Category': 'Legal', 'Priority': 'High', '#': '2' },
            ]);
            const liberty = createProject('Project Liberty', [
                { 'Request Title': 'Liberty Gamma', 'Category': 'Environmental', 'Priority': 'Medium', '#': '1' },
                { 'Request Title': 'Liberty Delta', 'Category': 'Regulatory', 'Priority': 'Low', '#': '2' },
            ]);

            const ksAlpha = getRequestByTitle(keystone.txnId, 'keystone alpha')!;
            const ksBeta = getRequestByTitle(keystone.txnId, 'keystone beta')!;
            const lbGamma = getRequestByTitle(liberty.txnId, 'liberty gamma')!;
            const lbDelta = getRequestByTitle(liberty.txnId, 'liberty delta')!;

            publishSelectedRequests([ksAlpha.id, ksBeta.id, lbGamma.id, lbDelta.id], { sourceIntakeId: 'multi-intake', sourcePackageId: 'multi-intake' });

            // Publish one request externally in EACH project
            uiAcceptWork(ksAlpha.id, CONTRIBUTOR, ksAlpha.title || '', ksAlpha.category || '', ksAlpha.transactionId, ksAlpha.transactionName || '');
            uiCompleteReview(ksAlpha.id, CONTRIBUTOR, '', ksAlpha.title || '', ksAlpha.category || '', ksAlpha.transactionId, ksAlpha.transactionName || '');
            uiPublishExternal(ksAlpha.id, DD_OPS_LEAD, ksAlpha.title || '', ksAlpha.category || '', ksAlpha.transactionId, ksAlpha.transactionName || '', ksAlpha.requestId);

            uiAcceptWork(lbGamma.id, CONTRIBUTOR, lbGamma.title || '', lbGamma.category || '', lbGamma.transactionId, lbGamma.transactionName || '');
            uiCompleteReview(lbGamma.id, CONTRIBUTOR, '', lbGamma.title || '', lbGamma.category || '', lbGamma.transactionId, lbGamma.transactionName || '');
            uiPublishExternal(lbGamma.id, DD_OPS_LEAD, lbGamma.title || '', lbGamma.category || '', lbGamma.transactionId, lbGamma.transactionName || '', lbGamma.requestId);

            const portalReqs = getPortalRequests();

            // No duplicates: one canonical request → exactly one portal projection
            const ids = portalReqs.map(r => r.id);
            expect(new Set(ids).size).toBe(ids.length);
            for (const r of [ksAlpha, ksBeta, lbGamma, lbDelta]) {
                expect(portalReqs.filter(p => p.id === r.id || p.requestId === r.id).length).toBe(1);
            }

            // All Projects: exactly 2 externally published → Awaiting Your Review
            const awaiting = portalReqs.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).status === 'Awaiting Your Review');
            expect(awaiting.length).toBe(2);
            const stats = getAggregateTransactionStats();
            expect(stats.transactionCount).toBe(2);
            expect(stats.byStatus['Awaiting Your Review']).toBe(2);

            // Per-project filter
            const ksOnly = portalReqs.filter(r => r.transactionName === 'Project Keystone');
            const lbOnly = portalReqs.filter(r => r.transactionName === 'Project Liberty');
            expect(ksOnly.length).toBe(2);
            expect(lbOnly.length).toBe(2);
            expect(ksOnly.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).status === 'Awaiting Your Review').length).toBe(1);
            expect(lbOnly.filter(r => getExternalStatusInfo(toExternalStatusInput(r)).status === 'Awaiting Your Review').length).toBe(1);

            // No stale Under Review projections for published requests
            for (const published of [ksAlpha, lbGamma]) {
                const p = portalReqs.find(x => x.id === published.id);
                expect(getExternalStatusInfo(toExternalStatusInput(p!)).status).toBe('Awaiting Your Review');
            }
        });
    });

    describe('TEST 5 — Org isolation', () => {
        it('Atlas requests are invisible to Summit and Harbor personas', () => {
            const { txnId } = setupProject('Project Atlas Deal', [
                { 'Request Title': 'Atlas Confidential', 'Category': 'Financial', 'Priority': 'High', '#': '1' },
            ]);
            const req = getRequestByTitle(txnId, 'atlas confidential');
            if (!req) throw new Error('Atlas request not found');
            expect(req.orgId).toBe('org-atlas');

            // Broker persona (Atlas) can see it
            setActivePersona('broker');
            const atlasView = getPortalRequests();
            expect(atlasView.some(r => r.id === req.id)).toBe(true);

            // Harbor persona cannot see it
            setActivePersona('owner-seller');
            const harborView = getPortalRequests();
            expect(harborView.some(r => r.id === req.id)).toBe(false);
            expect(harborView.length).toBe(0);

            // Summit persona cannot see it
            setActivePersona('buyer');
            const summitView = getPortalRequests();
            expect(summitView.some(r => r.id === req.id)).toBe(false);
            expect(summitView.length).toBe(0);

            // Selector diagnostics recorded the exclusion with reasons
            const excluded = getDiagBuffer().filter(e => e.type === 'EXTERNAL_REQUEST_EXCLUDED');
            expect(excluded.length).toBeGreaterThan(0);
            const reasons = excluded.map(e => e.data.reason);
            expect(reasons.some(r => typeof r === 'string' && r.includes('not in authorized transactions'))).toBe(true);
        });
    });

    describe('TEST 6 — Non-published internal work', () => {
        it('stays Under Review and never shows Awaiting Your Review before external publication', () => {
            const { txnId, submissionId } = setupProject('Project Keystone', [
                { 'Request Title': 'Internal Only Request', 'Category': 'Financial', 'Priority': 'High', '#': '1' },
            ]);
            const req = getRequestByTitle(txnId, 'internal only');
            if (!req) throw new Error('Internal request not found');

            // Intake publish only (enters internal queue) — not externally published
            publishSelectedRequests([req.id], { sourceIntakeId: `${submissionId}-intake`, sourcePackageId: `${submissionId}-intake` });
            expect(getRequestById(req.id)?._externalStatus).toBe('Internal Only');
            expect(getRequestById(req.id)?._publishedExternal).not.toBe(true);

            let portalReq = projected(req);
            expect(portalReq).toBeDefined();
            expect(portalReq?.externalStatus).toBe('Internal Only');
            expect(getExternalStatusInfo(toExternalStatusInput(portalReq!)).status).toBe('Under Review');
            expect(getExternalStatusInfo(toExternalStatusInput(portalReq!)).status).not.toBe('Awaiting Your Review');

            // Full internal workflow (Accept → Complete) still not externally published
            uiAcceptWork(req.id, CONTRIBUTOR, req.title || '', req.category || '', req.transactionId, req.transactionName || '');
            uiCompleteReview(req.id, CONTRIBUTOR, '', req.title || '', req.category || '', req.transactionId, req.transactionName || '');

            portalReq = projected(req);
            const beforePublish = getRequestById(req.id);
            diagRequestState('internal-only before external publish', beforePublish);
            expect(beforePublish?._publishedExternal).not.toBe(true);
            expect(beforePublish?._externalStatus).not.toBe('Published External');
            const internalStatus = getExternalStatusInfo(toExternalStatusInput(portalReq!)).status;
            expect(internalStatus).not.toBe('Awaiting Your Review');
        });
    });
});
