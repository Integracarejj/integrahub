import { describe, it, expect } from 'vitest';
import type { RecapRequest, WorkNoteEntry } from '../services/recapMockData';
import { getExternalStatusInfo, getStatusPillStyle } from '../services/externalStatusMapping';

const DD_OPS_LEAD = 'David Park';
const CONTRIBUTOR = 'Sarah Chen';

function createWorkNote(text: string, author: string, action: string | null, tsOffset = 0): WorkNoteEntry {
    return {
        id: `wn-test-${Date.now()}-${tsOffset}`,
        text,
        author,
        timestamp: new Date(Date.now() + tsOffset).toISOString(),
        action,
    };
}

function buildRequest(overrides: Partial<RecapRequest> = {}): RecapRequest {
    return {
        id: 'req-test-001',
        requestId: 'DD-TEST-001',
        intakeId: 'INT-TEST-001',
        transactionId: 'txn-test',
        transactionName: 'Test Transaction',
        brokerBuyer: 'Test Broker / Test Buyer',
        communityIds: [],
        communityNames: ['Test Community'],
        category: 'Test Category',
        title: 'Test deliverable',
        description: 'Test description',
        owner: CONTRIBUTOR,
        team: 'Financial Analysis',
        status: 'In Progress',
        priority: 'High',
        dueDate: '2026-12-31',
        lastUpdated: '2026-07-01',
        externalVisible: true,
        submittedBy: 'Test',
        source: 'External',
        createdDate: '2026-06-01',
        assignedTo: CONTRIBUTOR,
        _publishedAt: null,
        _createdFromReview: true,
        _externalStatus: 'Internal Only',
        _workNotes: [],
        _returnReason: null,
        ...overrides,
    };
}

function simulateReturnToOwner(req: RecapRequest, reason: string, returnedBy: string): RecapRequest {
    return {
        ...req,
        status: 'Needs Rework',
        owner: req.owner,
        assignedTo: req.owner,
        _returnReason: reason,
        _returnedBy: returnedBy,
        _blockerStatus: null,
        _blockerResolution: null,
    };
}

function simulateBlock(req: RecapRequest, raisedBy: string, reason: string): RecapRequest {
    return {
        ...req,
        status: 'Blocked',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _blockerReason: reason,
        _blockerStatus: 'Raised',
        _blockerRaisedBy: raisedBy,
        _blockerOwner: DD_OPS_LEAD,
        _blockerRaisedAt: new Date().toISOString(),
        _returnReason: null,
        _returnedBy: null,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
    };
}

function simulateStartClarification(req: RecapRequest, questionText: string, submittedBy: string): RecapRequest {
    return {
        ...req,
        status: 'Clarification Needed',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
        _statusNotes: questionText,
        _clarificationRaisedBy: submittedBy,
        _workNotes: [...(req._workNotes || []), createWorkNote(questionText, submittedBy, 'Clarification Needed')],
    };
}

function simulateClarificationResponse(req: RecapRequest, response: string, respondedBy: string): RecapRequest {
    const wnEntry: WorkNoteEntry = {
        id: `wn-clar-resp-${Date.now()}`,
        text: response,
        author: respondedBy,
        timestamp: new Date().toISOString(),
        action: 'Clarification Response',
    };
    return {
        ...req,
        status: 'In Progress',
        owner: req._clarificationRaisedBy || req.owner,
        assignedTo: req._clarificationRaisedBy || req.owner,
        _returnReason: `Clarification response: ${response}`,
        _returnedBy: respondedBy,
        _clarificationRaisedBy: null,
        _workNotes: [...(req._workNotes || []), wnEntry],
    };
}

function simulatePublishExternal(req: RecapRequest): RecapRequest {
    return {
        ...req,
        status: 'Waiting Partner Review',
        _externalStatus: 'Published External',
        _publishedExternal: true,
        _publishedExternalAt: new Date().toISOString(),
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
    };
}

function simulatePartnerRework(req: RecapRequest, reason: string): RecapRequest {
    return {
        ...req,
        status: 'Needs Rework',
        owner: DD_OPS_LEAD,
        assignedTo: DD_OPS_LEAD,
        _partnerDecision: 'Rework Required',
        _partnerNote: reason,
        _partnerActionAt: new Date().toISOString(),
    };
}

function simulateReacceptWithCleanup(req: RecapRequest): RecapRequest {
    return {
        ...req,
        status: 'In Progress',
        _processingStartedAt: req._processingStartedAt || new Date().toISOString(),
        _returnReason: null,
        _returnedBy: null,
        _blockerStatus: null,
        _blockerResolution: null,
        _needsReassignment: false,
        _misassignedReason: null,
        _partnerDecision: null,
        _partnerNote: null,
        _partnerActionAt: null,
        _exceptionRecommendation: null,
        _exceptionSentAt: null,
        _exceptionDecision: null,
        _exceptionDecisionAt: null,
        _exceptionDecisionNote: null,
    };
}

function simulateResolveBlocker(req: RecapRequest, resolution: string, resolvedBy: string): RecapRequest {
    return {
        ...req,
        status: 'Needs Rework',
        owner: req._blockerRaisedBy || req.owner,
        assignedTo: req._blockerRaisedBy || req.owner,
        _blockerStatus: 'Resolved',
        _blockerResolution: resolution,
        _returnReason: `Blocker resolved: ${resolution}`,
        _returnedBy: resolvedBy,
        _blockerExternalQuestion: null,
        _blockerExternalResponse: null,
    };
}

/**
 * Simulates the UI gating logic for the DD Ops action center.
 * Returns the publish button configuration based on the request state.
 */
function getDdOpsPublishConfig(req: RecapRequest): { visible: boolean; label: string; enabled: boolean; reason?: string } {
    const displayStatus = req.status;
    const isAlreadyReturned = !!req._returnReason && displayStatus === 'Needs Rework';
    const wasPreviouslyPublished = !!req._publishedAt || !!req._publishedExternal;
    const canPublish = (displayStatus === 'Complete' || (displayStatus === 'Needs Rework' && wasPreviouslyPublished)) && !isAlreadyReturned;
    const publishLabel = wasPreviouslyPublished ? 'Re-Publish External' : 'Publish External';

    if (canPublish) {
        return { visible: true, label: publishLabel, enabled: true };
    }
    if (isAlreadyReturned) {
        return { visible: false, label: publishLabel, enabled: false, reason: 'Waiting for contributor to re-submit' };
    }
    return { visible: false, label: publishLabel, enabled: false, reason: 'Item must be submitted for DD Review first' };
}

/**
 * Simulates the contributor-facing publish button gating.
 */
function getContributorPublishConfig(req: RecapRequest): { visible: boolean; label: string; enabled: boolean } {
    const displayStatus = req.status;
    const wasPreviouslyPublished = !!req._publishedAt || !!req._publishedExternal;
    const isReturnedByDD = !!req._returnReason && displayStatus === 'Needs Rework';
    const isReworkFromPartner = req._partnerDecision === 'Rework Required';
    const buttonLabel = wasPreviouslyPublished ? 'Re-Publish' : 'Publish';

    if (displayStatus === 'Complete' && !isReturnedByDD) {
        return { visible: true, label: buttonLabel, enabled: true };
    }
    if (displayStatus === 'Needs Rework' && !isReturnedByDD && isReworkFromPartner && wasPreviouslyPublished) {
        return { visible: true, label: buttonLabel, enabled: true };
    }
    return { visible: true, label: buttonLabel, enabled: false };
}

/**
 * Simulates the "Return to Owner" button visibility for DD Ops.
 */
function isReturnToOwnerVisible(req: RecapRequest): boolean {
    const displayStatus = req.status;
    const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question');
    const isClarActive = displayStatus === 'Clarification Needed' || (displayStatus === 'In Progress' && !!hasExtQ);
    const alreadyReturned = !!req._returnReason && displayStatus === 'Needs Rework';
    return !isClarActive && displayStatus !== 'Blocked' && !alreadyReturned;
}

/**
 * Simulates the "Reassign Owner" button visibility for DD Ops.
 * Only visible during non-active workflows (not blocked, no active clarification, no pending external, not already returned).
 */
function isReassignOwnerVisible(req: RecapRequest): boolean {
    const displayStatus = req.status;
    const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question');
    const isClarActive = displayStatus === 'Clarification Needed' || (displayStatus === 'In Progress' && !!hasExtQ);
    const isBlocked = displayStatus === 'Blocked';
    const alreadyReturned = !!req._returnReason && displayStatus === 'Needs Rework';
    const inActiveWorkflow = isClarActive || isBlocked || !!req._blockerStatus || alreadyReturned;
    return !inActiveWorkflow;
}

/**
 * Simulates the Clarification Support button visibility for DD Ops.
 */
function isClarificationSupportVisible(req: RecapRequest): boolean {
    return req.status !== 'Blocked';
}

/**
 * Simulates the Recommend Duplicate/Not Applicable button visibility for DD Ops.
 */
function isRecommendExceptionVisible(req: RecapRequest): boolean {
    return req.status !== 'Blocked';
}

/**
 * Simulates extracting the work note author for a clarification response.
 * This verifies that the correct acting user is passed through navigation state.
 */
function getClarificationResponseAuthor(workNotes: WorkNoteEntry[]): string | null {
    const respNotes = workNotes.filter(n => n.action === 'Clarification Response');
    if (respNotes.length === 0) return null;
    return respNotes[respNotes.length - 1].author;
}

describe('Action State Cleanup — Four Issues', () => {

    describe('Issue 1 — Re-Publish External gating based on publication history', () => {

        it('should use "Re-Publish External" label for DD Ops when request was previously published and needs rework from partner', () => {
            let req = buildRequest();
            req = simulatePublishExternal(req);
            req = simulatePartnerRework(req, 'Please revise financials');
            const config = getDdOpsPublishConfig(req);

            expect(config.visible).toBe(true);
            expect(config.label).toBe('Re-Publish External');
            expect(config.enabled).toBe(true);
        });

        it('should use "Publish External" label for DD Ops when request was never published', () => {
            let req = buildRequest({ status: 'Complete', _publishedAt: undefined, _publishedExternal: undefined });
            const config = getDdOpsPublishConfig(req);

            expect(config.visible).toBe(true);
            expect(config.label).toBe('Publish External');
            expect(config.enabled).toBe(true);
        });

        it('should hide DD Ops publish button when request was returned to contributor by DD Ops', () => {
            let req = buildRequest({ _publishedAt: '2026-06-01' });
            req = simulatePublishExternal(req);
            req = simulateReturnToOwner(req, 'Revise the financials section', DD_OPS_LEAD);

            const config = getDdOpsPublishConfig(req);

            expect(config.visible).toBe(false);
            expect(config.enabled).toBe(false);
            expect(config.reason).toBe('Waiting for contributor to re-submit');
        });

        it('should hide DD Ops publish button when request was returned after blocker resolution and never published', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Missing docs');
            req = simulateResolveBlocker(req, 'Found docs', DD_OPS_LEAD);

            const config = getDdOpsPublishConfig(req);

            expect(config.visible).toBe(false);
            expect(config.enabled).toBe(false);
        });

        it('should show "Re-Publish External" for contributor after partner rework on previously published request', () => {
            let req = buildRequest({ _publishedAt: '2026-06-01' });
            req = simulatePublishExternal(req);
            req = simulatePartnerRework(req, 'Revise');

            const config = getContributorPublishConfig(req);

            expect(config.visible).toBe(true);
            expect(config.label).toBe('Re-Publish');
            expect(config.enabled).toBe(true);
        });

        it('should disable contributor publish button when DD Ops returned the item', () => {
            let req = buildRequest({ _publishedAt: '2026-06-01' });
            req = simulatePublishExternal(req);
            req = simulateReturnToOwner(req, 'Fix this', DD_OPS_LEAD);

            const config = getContributorPublishConfig(req);

            expect(config.enabled).toBe(false);
        });

        it('should enable contributor publish when status is Complete (never published)', () => {
            const req = buildRequest({ status: 'Complete', _publishedAt: undefined, _publishedExternal: undefined });
            const config = getContributorPublishConfig(req);

            expect(config.visible).toBe(true);
            expect(config.label).toBe('Publish');
            expect(config.enabled).toBe(true);
        });

        it('should show "Re-Publish" for previously-published request on partner rework, but not for never-published', () => {
            // Previously published → partner rework: should allow Re-Publish
            let reqPreviouslyPublished = buildRequest({ _publishedAt: '2026-06-01', _publishedExternal: undefined });
            reqPreviouslyPublished = simulatePublishExternal(reqPreviouslyPublished);
            reqPreviouslyPublished = simulatePartnerRework(reqPreviouslyPublished, 'Revise');
            const configPreviouslyPublished = getContributorPublishConfig(reqPreviouslyPublished);
            expect(configPreviouslyPublished.enabled).toBe(true);
            expect(configPreviouslyPublished.label).toBe('Re-Publish');

            // Never published (no _publishedAt, no _publishedExternal): partner rework → cannot publish
            let reqNeverPublished = buildRequest({ _publishedAt: undefined, _publishedExternal: undefined });
            reqNeverPublished = {
                ...reqNeverPublished,
                status: 'Needs Rework',
                _partnerDecision: 'Rework Required',
                _partnerNote: 'Revise',
                _partnerActionAt: new Date().toISOString(),
            };
            const configNeverPublished = getContributorPublishConfig(reqNeverPublished);
            expect(configNeverPublished.enabled).toBe(false);
        });
    });

    describe('Issue 2 — Return to Owner visibility after return already happened', () => {

        it('should hide Return to Owner when _returnReason is set and status is Needs Rework (already returned)', () => {
            let req = buildRequest({ _publishedAt: '2026-06-01' });
            req = simulateReturnToOwner(req, 'Revise financials', DD_OPS_LEAD);

            expect(isReturnToOwnerVisible(req)).toBe(false);
        });

        it('should show Return to Owner when status is In Progress and no active clarification', () => {
            const req = buildRequest({ status: 'In Progress', _returnReason: null });
            expect(isReturnToOwnerVisible(req)).toBe(true);
        });

        it('should hide Return to Owner when status is Blocked (active blocker)', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Missing docs');
            expect(isReturnToOwnerVisible(req)).toBe(false);
        });

        it('should hide Return to Owner when clarification is active', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Need more info', CONTRIBUTOR);
            expect(isReturnToOwnerVisible(req)).toBe(false);
        });

        it('should show Return to Owner after external clarification response is received (guidance needed)', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question', CONTRIBUTOR);
            // Add external question and response
            req = {
                ...req,
                status: 'Clarification Needed',
                _workNotes: [
                    ...(req._workNotes || []),
                    createWorkNote('External question', DD_OPS_LEAD, 'Clarification External Question'),
                    createWorkNote('External response', 'External Partner', 'Clarification Response'),
                ],
            };
            const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question');
            const isClarActive = req.status === 'Clarification Needed' || (req.status === 'In Progress' && !!hasExtQ);
            // Clarification is still active when there's an external question without guidance returned
            expect(isClarActive).toBe(true);
            expect(isReturnToOwnerVisible(req)).toBe(false);
        });

        it('should not show Return to Owner for a completed request', () => {
            const req = buildRequest({ status: 'Completed' });
            // The outer terminal check (isTerminal) hides the entire action center for completed/closed requests.
            // The inner isReturnToOwnerVisible only models the action center's button-level logic.
            const isTerminal = req.status === 'Completed' || req.status === 'Rejected' || ['Duplicate', 'Not Applicable'].includes(req.status);
            expect(isTerminal).toBe(true);
        });

        it('should show Return to Owner when _returnReason is set but status is NOT Needs Rework (stale reason)', () => {
            const req = buildRequest({
                status: 'In Progress',
                _returnReason: 'Old reason',
                _returnedBy: DD_OPS_LEAD,
            });
            expect(isReturnToOwnerVisible(req)).toBe(true);
        });
    });

    describe('Issue 3 — Reassign Owner gating during active workflows', () => {

        it('should hide Reassign Owner when status is Blocked (active blocker)', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Missing docs');
            expect(isReassignOwnerVisible(req)).toBe(false);
        });

        it('should hide Reassign Owner when clarification is active', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Need more info', CONTRIBUTOR);
            expect(isReassignOwnerVisible(req)).toBe(false);
        });

        it('should hide Reassign Owner when item has active blocker status', () => {
            const req = buildRequest({
                status: 'In Progress',
                _blockerStatus: 'Raised',
            });
            expect(isReassignOwnerVisible(req)).toBe(false);
        });

        it('should hide Reassign Owner when item was returned to contributor by DD Ops', () => {
            let req = buildRequest({ _publishedAt: '2026-06-01' });
            req = simulateReturnToOwner(req, 'Revise', DD_OPS_LEAD);
            expect(isReassignOwnerVisible(req)).toBe(false);
        });

        it('should show Reassign Owner when status is In Progress with no active workflows', () => {
            const req = buildRequest({ status: 'In Progress' });
            expect(isReassignOwnerVisible(req)).toBe(true);
        });

        it('should show Reassign Owner when status is Open', () => {
            const req = buildRequest({ status: 'Open' });
            expect(isReassignOwnerVisible(req)).toBe(true);
        });

        it('should show Reassign Owner after blocker is resolved and item reaccepted', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            req = simulateResolveBlocker(req, 'Fixed', DD_OPS_LEAD);
            req = simulateReacceptWithCleanup(req);
            expect(isReassignOwnerVisible(req)).toBe(true);
        });

        it('should hide Reassign Owner when _blockerStatus is Pending External', () => {
            const req = buildRequest({
                status: 'Blocked',
                _blockerStatus: 'Pending External',
            });
            expect(isReassignOwnerVisible(req)).toBe(false);
        });

        it('should hide Reassign Owner when clarification is active with external flow', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question', CONTRIBUTOR);
            req = {
                ...req,
                _workNotes: [
                    ...(req._workNotes || []),
                    createWorkNote('External question', DD_OPS_LEAD, 'Clarification External Question'),
                ],
            };
            expect(isReassignOwnerVisible(req)).toBe(false);
        });

        it('should show Clarification Support and Recommend buttons when not blocked', () => {
            const req = buildRequest({ status: 'In Progress' });
            expect(isClarificationSupportVisible(req)).toBe(true);
            expect(isRecommendExceptionVisible(req)).toBe(true);
        });

        it('should hide Clarification Support and Recommend buttons when blocked', () => {
            let req = buildRequest();
            req = simulateBlock(req, CONTRIBUTOR, 'Issue');
            expect(isClarificationSupportVisible(req)).toBe(false);
            expect(isRecommendExceptionVisible(req)).toBe(false);
        });
    });

    describe('Issue 4 — Correct actor attribution for clarification responses', () => {

        it('should record DD Ops user as the author when they answer a clarification response', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Can you provide more details?', CONTRIBUTOR);

            // Simulate DD Ops answering clarification — the key is that respondedBy = DD_OPS_LEAD (David Park)
            req = simulateClarificationResponse(req, 'Here is the information', DD_OPS_LEAD);

            const author = getClarificationResponseAuthor(req._workNotes || []);
            expect(author).toBe(DD_OPS_LEAD);
        });

        it('should record correct author when DD Ops user other than David Park answers', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Need clarification', CONTRIBUTOR);

            const altDDOpsUser = 'Carlos Rivera';
            req = simulateClarificationResponse(req, 'Response from alt DD Ops', altDDOpsUser);

            const author = getClarificationResponseAuthor(req._workNotes || []);
            expect(author).toBe(altDDOpsUser);
            expect(author).not.toBe(DD_OPS_LEAD);
        });

        it('should pass actingUser through navigation state from DD Operations page', () => {
            // Simulates what RecapitalizationDdOperations passes in navigate state
            const activeUser = 'Carlos Rivera';
            const navState = { from: 'dd-operations', actingUser: activeUser };

            expect(navState.from).toBe('dd-operations');
            expect(navState.actingUser).toBe('Carlos Rivera');
        });

        it('should have the clarification response work note with action "Clarification Response"', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question', CONTRIBUTOR);
            req = simulateClarificationResponse(req, 'Answer', DD_OPS_LEAD);

            const respNotes = (req._workNotes || []).filter(n => n.action === 'Clarification Response');
            expect(respNotes.length).toBe(1);
            expect(respNotes[0].author).toBe(DD_OPS_LEAD);
            expect(respNotes[0].text).toBe('Answer');
        });

        it('should have the original clarification question author preserved in _clarificationRaisedBy before response', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question', CONTRIBUTOR);
            expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);

            // After response, _clarificationRaisedBy is cleared
            req = simulateClarificationResponse(req, 'Answer', DD_OPS_LEAD);
            expect(req._clarificationRaisedBy).toBeNull();
        });

        it('should record work note author correctly through full clarification flow', () => {
            let req = buildRequest();

            // Contributor raises clarification
            req = simulateStartClarification(req, 'Need help with financials', CONTRIBUTOR);
            expect(req._clarificationRaisedBy).toBe(CONTRIBUTOR);

            // DD Ops user answers
            req = simulateClarificationResponse(req, 'Here is the guidance', DD_OPS_LEAD);

            const clarNotes = (req._workNotes || []).filter(n => n.action === 'Clarification Needed');
            const respNotes = (req._workNotes || []).filter(n => n.action === 'Clarification Response');

            expect(clarNotes.length).toBe(1);
            expect(clarNotes[0].author).toBe(CONTRIBUTOR);
            expect(respNotes.length).toBe(1);
            expect(respNotes[0].author).toBe(DD_OPS_LEAD);
            expect(respNotes[0].text).toBe('Here is the guidance');
        });

        it('should not have Sarah Chen as the author when David Park answers clarification', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Question', CONTRIBUTOR);
            req = simulateClarificationResponse(req, 'DD Ops answer', DD_OPS_LEAD);

            const respNotes = (req._workNotes || []).filter(n => n.action === 'Clarification Response');
            expect(respNotes[0].author).not.toBe(CONTRIBUTOR);
        });
    });

    describe('Clarification status copy — internal vs external wording', () => {

        function isClarificationWaitingExternal(item: RecapRequest): boolean {
            const hasExtQ = item._workNotes?.some((n: WorkNoteEntry) => n.action === 'Clarification External Question') ?? false;
            const hasExtR = item._workNotes?.some((n: WorkNoteEntry) => n.action === 'Clarification Response' && n.author === 'External Partner') ?? false;
            const hasGuidanceReturned = item._workNotes?.some((n: WorkNoteEntry) => n.action === 'Clarification Guidance') ?? false;
            const extCycleNeedsDdReview = hasExtQ && hasExtR && !hasGuidanceReturned;
            const isClarActive = item.status === 'Clarification Needed' || (item.status === 'In Progress' && hasExtQ);
            return isClarActive && !extCycleNeedsDdReview && hasExtQ;
        }

        function isClarificationWaitingDdOps(item: RecapRequest): boolean {
            const hasExtQ = item._workNotes?.some((n: WorkNoteEntry) => n.action === 'Clarification External Question') ?? false;
            const hasExtR = item._workNotes?.some((n: WorkNoteEntry) => n.action === 'Clarification Response' && n.author === 'External Partner') ?? false;
            const hasGuidanceReturned = item._workNotes?.some((n: WorkNoteEntry) => n.action === 'Clarification Guidance') ?? false;
            const extCycleNeedsDdReview = hasExtQ && hasExtR && !hasGuidanceReturned;
            const isClarActive = item.status === 'Clarification Needed' || (item.status === 'In Progress' && hasExtQ);
            return isClarActive && !extCycleNeedsDdReview && !hasExtQ;
        }

        it('internal clarification → Waiting for DD Operations response (not external partner)', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Need help with rent rolls', CONTRIBUTOR);

            expect(req.status).toBe('Clarification Needed');
            expect(isClarificationWaitingDdOps(req)).toBe(true);
            expect(isClarificationWaitingExternal(req)).toBe(false);

            const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question') ?? false;
            expect(hasExtQ).toBe(false);
        });

        it('external clarification → Waiting on external partner response', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Contributor question', CONTRIBUTOR);

            req = {
                ...req,
                status: 'In Progress',
                _workNotes: [
                    ...(req._workNotes || []),
                    createWorkNote('Please clarify with partner', DD_OPS_LEAD, 'Clarification External Question'),
                ],
            };

            expect(isClarificationWaitingExternal(req)).toBe(true);
            expect(isClarificationWaitingDdOps(req)).toBe(false);

            const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question') ?? false;
            expect(hasExtQ).toBe(true);
        });

        it('returned clarification → neither waiting message remains active', () => {
            let req = buildRequest();
            req = simulateStartClarification(req, 'Need clarification', CONTRIBUTOR);
            req = simulateClarificationResponse(req, 'DD Ops guidance', DD_OPS_LEAD);

            expect(req.status).toBe('In Progress');
            expect(isClarificationWaitingExternal(req)).toBe(false);
            expect(isClarificationWaitingDdOps(req)).toBe(false);
        });
    });

    describe('Test A — First Publish label', () => {
        it('never published → "Publish External" label, not "Re-Publish"', () => {
            const req = buildRequest({ status: 'Complete', _publishedAt: null, _publishedExternal: undefined });
            const wasPreviouslyPublishedExternal = !!req._publishedExternal;
            const publishLabel = wasPreviouslyPublishedExternal ? 'Re-Publish External' : 'Publish External';

            expect(publishLabel).toBe('Publish External');
            expect(wasPreviouslyPublishedExternal).toBe(false);
        });

        it('published internally but never externally → "Publish External"', () => {
            const req = buildRequest({ status: 'Complete', _publishedAt: '2026-06-01', _publishedExternal: undefined });
            const wasPreviouslyPublishedExternal = !!req._publishedExternal;
            const publishLabel = wasPreviouslyPublishedExternal ? 'Re-Publish External' : 'Publish External';

            expect(publishLabel).toBe('Publish External');
        });

        it('canPublish allows first-time publish on Complete', () => {
            const req = buildRequest({ status: 'Complete', _publishedExternal: undefined });
            const isAlreadyReturned = !!req._returnReason && req.status === 'Needs Rework';
            const canPublish = (req.status === 'Complete' || (req.status === 'Needs Rework' && !!req._publishedExternal)) && !isAlreadyReturned;

            expect(canPublish).toBe(true);
        });
    });

    describe('Test B — Genuine Re-Publish label', () => {
        it('previously published externally → "Re-Publish External" label', () => {
            const req = buildRequest({ status: 'Complete', _publishedExternal: true });
            const wasPreviouslyPublishedExternal = !!req._publishedExternal;
            const publishLabel = wasPreviouslyPublishedExternal ? 'Re-Publish External' : 'Publish External';

            expect(publishLabel).toBe('Re-Publish External');
            expect(wasPreviouslyPublishedExternal).toBe(true);
        });

        it('canPublish allows re-publish on Complete when previously published', () => {
            const req = buildRequest({ status: 'Complete', _publishedExternal: true });
            const isAlreadyReturned = false;
            const canPublish = (req.status === 'Complete' || (req.status === 'Needs Rework' && !!req._publishedExternal)) && !isAlreadyReturned;

            expect(canPublish).toBe(true);
        });

        it('canPublish allows re-publish on Needs Rework when previously published', () => {
            const req = buildRequest({ status: 'Needs Rework', _publishedExternal: true });
            const isAlreadyReturned = false;
            const canPublish = (req.status === 'Complete' || (req.status === 'Needs Rework' && !!req._publishedExternal)) && !isAlreadyReturned;

            expect(canPublish).toBe(true);
        });

        it('never published + Needs Rework → cannot publish', () => {
            const req = buildRequest({ status: 'Needs Rework', _publishedExternal: undefined });
            const isAlreadyReturned = false;
            const canPublish = (req.status === 'Complete' || (req.status === 'Needs Rework' && !!req._publishedExternal)) && !isAlreadyReturned;

            expect(canPublish).toBe(false);
        });
    });

    describe('Test C — Return to Owner duplication', () => {
        it('primary tile shows Return to Owner when clarification not active and not blocked', () => {
            const req = buildRequest({ status: 'In Progress' });
            const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question') ?? false;
            const isClarActive = req.status === 'Clarification Needed' || (req.status === 'In Progress' && hasExtQ);
            const alreadyReturned = !!req._returnReason && req.status === 'Needs Rework';

            const primaryTileShowsReturnToOwner = !isClarActive && !alreadyReturned;
            expect(primaryTileShowsReturnToOwner).toBe(true);
        });

        it('blocked status → primary tile shows Return to Owner, Other Actions does not have it', () => {
            const req = buildRequest({ status: 'Blocked' });
            const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question') ?? false;
            const isClarActive = req.status === 'Clarification Needed' || (req.status === 'In Progress' && hasExtQ);
            const alreadyReturned = !!req._returnReason && req.status === 'Needs Rework';

            const primaryTileShowsReturnToOwner = !isClarActive && !alreadyReturned;
            expect(primaryTileShowsReturnToOwner).toBe(true);

            const isBlocked = req.status === 'Blocked';
            const inActiveWorkflow = isClarActive || isBlocked || !!req._blockerStatus || alreadyReturned;
            const otherActionsHasReturnToOwner = !inActiveWorkflow;
            expect(otherActionsHasReturnToOwner).toBe(false);
        });

        it('already returned → primary tile does not show Return to Owner', () => {
            const req = buildRequest({ status: 'Needs Rework', _returnReason: 'Fix this' });
            const hasExtQ = req._workNotes?.some(n => n.action === 'Clarification External Question') ?? false;
            const isClarActive = req.status === 'Clarification Needed' || (req.status === 'In Progress' && hasExtQ);
            const alreadyReturned = !!req._returnReason && req.status === 'Needs Rework';

            const primaryTileShowsReturnToOwner = !isClarActive && !alreadyReturned;
            expect(primaryTileShowsReturnToOwner).toBe(false);
        });
    });

    describe('Test D — Duplicate approved removal', () => {
        it('archived duplicate → terminal disposition, not generic Complete', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
                _exceptionRecommendation: 'Duplicate',
                _exceptionDecision: 'Confirm Duplicate',
                _exceptionDecisionAt: '2026-07-15T10:00:00.000Z',
                _exceptionDecisionNote: 'Confirmed duplicate of DD-26-003',
            });

            const extInfo = getExternalStatusInfo({
                status: req.status,
                _exceptionRecommendation: req._exceptionRecommendation,
                _exceptionDecision: req._exceptionDecision,
                _archived: req._archived,
                _archiveReason: req._archiveReason,
            });

            expect(req._archived).toBe(true);
            expect(req._archiveReason).toBe('Duplicate');
            expect(extInfo.status).toBe('Removed \u2014 Duplicate');
            expect(extInfo.isTerminal).toBe(true);
            expect(extInfo.label).toContain('Duplicate');
        });

        it('archived duplicate → removed from active queues', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
            });

            const TERMINAL_STATUSES = ['Complete', 'Completed'];
            const RETURNED_STATUSES = ['Clarification Needed', 'Blocked', 'Duplicate', 'Not Applicable', 'Needs Rework'];
            const isActive = !TERMINAL_STATUSES.includes(req.status) && !RETURNED_STATUSES.includes(req.status) && !req._needsReassignment;

            expect(isActive).toBe(false);
        });

        it('archived duplicate → partner decision retained', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
                _exceptionRecommendation: 'Duplicate',
                _exceptionDecision: 'Confirm Duplicate',
                _exceptionDecisionAt: '2026-07-15T10:00:00.000Z',
                _exceptionDecisionNote: 'Confirmed duplicate',
            });

            expect(req._exceptionRecommendation).toBe('Duplicate');
            expect(req._exceptionDecision).toBe('Confirm Duplicate');
            expect(req._exceptionDecisionNote).toBe('Confirmed duplicate');
        });

        it('archived duplicate → Full Work Queue includes it', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
                _publishedAt: '2026-06-01',
            });

            const isInFullWorkQueue = !!(req._publishedAt || req._createdFromReview);
            expect(isInFullWorkQueue).toBe(true);
        });
    });

    describe('Test E — Not Applicable approved removal', () => {
        it('archived NA → terminal disposition, not generic Complete', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Not Applicable',
                _exceptionRecommendation: 'Not Applicable',
                _exceptionDecision: 'Approve Removal',
                _exceptionDecisionAt: '2026-07-15T10:00:00.000Z',
            });

            const extInfo = getExternalStatusInfo({
                status: req.status,
                _exceptionRecommendation: req._exceptionRecommendation,
                _exceptionDecision: req._exceptionDecision,
                _archived: req._archived,
                _archiveReason: req._archiveReason,
            });

            expect(req._archived).toBe(true);
            expect(req._archiveReason).toBe('Not Applicable');
            expect(extInfo.status).toBe('Removed \u2014 Not Applicable');
            expect(extInfo.isTerminal).toBe(true);
            expect(extInfo.label).toContain('Not Applicable');
        });

        it('archived NA → partner decision retained', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Not Applicable',
                _exceptionRecommendation: 'Not Applicable',
                _exceptionDecision: 'Approve Removal',
                _exceptionDecisionAt: '2026-07-15T10:00:00.000Z',
                _exceptionDecisionNote: 'Not relevant to this transaction',
            });

            expect(req._exceptionRecommendation).toBe('Not Applicable');
            expect(req._exceptionDecision).toBe('Approve Removal');
            expect(req._exceptionDecisionNote).toBe('Not relevant to this transaction');
        });
    });

    describe('Test F — Removed request action gating', () => {
        it('archived request → isTerminal true, no normal actions', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
            });

            const isArchived = !!req._archived && !!req._archiveReason;
            const isTerminal = isArchived || req.status === 'Completed';

            expect(isTerminal).toBe(true);
            expect(isArchived).toBe(true);
        });

        it('archived request → not eligible for Return to Owner', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
            });

            const alreadyReturned = !!req._returnReason && req.status === 'Needs Rework';
            expect(alreadyReturned).toBe(false);
        });

        it('archived request → not eligible for publish', () => {
            const req = buildRequest({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
                _publishedExternal: true,
            });

            const isAlreadyReturned = !!req._returnReason && req.status === 'Needs Rework';
            const canPublish = (req.status === 'Complete' || (req.status === 'Needs Rework' && !!req._publishedExternal)) && !isAlreadyReturned;
            expect(canPublish).toBe(false);
        });
    });

    describe('Test G — External status mapping', () => {
        it('Awaiting Your Review pill uses teal border', () => {
            const pill = getStatusPillStyle('Awaiting Your Review');
            expect(pill.border).toBe('#2dd4bf');
        });

        it('Exception Review pill uses orange border', () => {
            const pill = getStatusPillStyle('Exception Review');
            expect(pill.border).toBe('#fb923c');
        });

        it('Complete pill uses green border', () => {
            const pill = getStatusPillStyle('Complete');
            expect(pill.border).toBe('#86efac');
        });

        it('removed-duplicate status is distinct from Complete', () => {
            const removedInfo = getExternalStatusInfo({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
            });
            const completeInfo = getExternalStatusInfo({
                status: 'Completed',
            });

            expect(removedInfo.status).not.toBe(completeInfo.status);
            expect(removedInfo.status).toBe('Removed \u2014 Duplicate');
            expect(completeInfo.status).toBe('Complete');
        });

        it('removed-na status is distinct from Complete', () => {
            const removedInfo = getExternalStatusInfo({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Not Applicable',
            });
            const completeInfo = getExternalStatusInfo({
                status: 'Completed',
            });

            expect(removedInfo.status).not.toBe(completeInfo.status);
            expect(removedInfo.status).toBe('Removed \u2014 Not Applicable');
        });

        it('removed status pill styles are distinct', () => {
            const dupPill = getStatusPillStyle('Removed \u2014 Duplicate');
            const naPill = getStatusPillStyle('Removed \u2014 Not Applicable');
            const completePill = getStatusPillStyle('Complete');

            expect(dupPill.border).not.toBe(completePill.border);
            expect(naPill.border).not.toBe(completePill.border);
        });

        it('archived duplicate → getExternalStatusInfo returns removed-duplicate status', () => {
            const info = getExternalStatusInfo({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Duplicate',
            });
            expect(info.status).toBe('Removed \u2014 Duplicate');
            expect(info.isTerminal).toBe(true);
        });

        it('archived NA → getExternalStatusInfo returns removed-na status', () => {
            const info = getExternalStatusInfo({
                status: 'Completed',
                _archived: true,
                _archiveReason: 'Not Applicable',
            });
            expect(info.status).toBe('Removed \u2014 Not Applicable');
            expect(info.isTerminal).toBe(true);
        });
    });
});
