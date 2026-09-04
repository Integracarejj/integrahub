import { recapWorkItemRepository } from "./recapWorkItemRepository.js";

export class RecapWorkItemValidationError extends Error {}
export class RecapWorkItemConflictError extends Error {}
export class RecapWorkItemAuthorizationError extends Error {}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^0x[0-9a-f]{16}$/i;
function text(value, max, label = "Text") {
    if (value == null) return null;
    const normalized = String(value).trim();
    if (normalized.length > max) throw new RecapWorkItemValidationError(`${label} must be ${max.toLocaleString("en-US")} characters or fewer`);
    return normalized;
}
const isOperationsActor = actor => ["PlatformAdmin", "DDTeam"].includes(actor?.globalRole);

export function serializeRowVersion(value) {
    if (typeof value === "string" && VERSION.test(value.trim())) return value.trim().toLowerCase();
    if (Buffer.isBuffer(value) && value.length === 8) return `0x${value.toString("hex")}`;
    if (value?.type === "Buffer" && Array.isArray(value.data) && value.data.length === 8 && value.data.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        return `0x${Buffer.from(value.data).toString("hex")}`;
    }
    return value;
}

function requireOperations(actor) {
    if (!isOperationsActor(actor)) throw new RecapWorkItemAuthorizationError("DD Operations access required");
}

function version(value) {
    if (value == null || value === "") throw new RecapWorkItemValidationError("Expected work item version is required");
    if (!VERSION.test(String(value))) throw new RecapWorkItemValidationError("Invalid work item version");
    return String(value);
}

async function transition(operation) {
    try {
        return await operation();
    } catch (error) {
        if (/cannot be .*or is stale|transition cannot be applied or is stale/i.test(error?.message || "")) {
            throw new RecapWorkItemConflictError("Work item changed; refresh and try again");
        }
        throw error;
    }
}

async function requireMutableOwner(repository, id, actor) {
    if (!actor?.id || actor.globalRole === "Viewer") throw new RecapWorkItemAuthorizationError("Assigned owner access required");
    const row = await repository.get(id);
    if (!row || row.assignedUserId !== actor.id) throw new RecapWorkItemAuthorizationError("Assigned owner access required");
    return row;
}

function mapRow(row, actor) {
    const isOperations = isOperationsActor(actor);
    const isOwner = !!actor?.id && row.assignedUserId === actor.id;
    return {
        ...row,
        version: serializeRowVersion(row.version),
        communities: JSON.parse(row.communityNamesJson || "[]"),
        communityNamesJson: undefined,
        needsReassignment: !!row.needsReassignment,
        capabilities: {
            canAssign: isOperations && row.status === "Queued", canAccept: row.status === "Assigned" && isOwner,
            canMarkNotMine: !!row.assignedUserId && (isOwner || isOperations), canReassign: isOperations && !!row.assignedUserId,
            canClarify: isOwner && actor?.globalRole !== "Viewer" && row.status === "In Progress",
            canBlock: isOwner && actor?.globalRole !== "Viewer" && row.status === "In Progress",
            canSubmitForDdReview: row.status === "In Progress" && !!actor?.id && row.assignedUserId === actor.id,
            canComplete: false,
            canReturnFromDdReview: isOperations && row.status === "Needs DD Review" && !!row.assignedUserId,
            canMarkReadyToPublish: isOperations && row.status === "Needs DD Review" && !!row.assignedUserId,
            canPublish: false,
            canUploadArtifact: isOwner && row.status === "In Progress",
            canViewArtifacts: (isOwner || isOperations) && !!row.assignedUserId,
            canDownloadArtifacts: (isOwner || isOperations) && !!row.assignedUserId,
            canMarkDuplicate: isOwner && actor?.globalRole !== "Viewer" && row.status === "In Progress",
            canMarkNotApplicable: isOwner && actor?.globalRole !== "Viewer" && row.status === "In Progress",
            canUpdateResponse: isOwner && actor?.globalRole !== "Viewer" && row.status === "In Progress",
            canResolveClarification: isOperations && row.status === "Clarification Needed",
            canUnblock: isOperations && row.status === "Blocked",
            canReviewDisposition: isOperations && row.status === "Needs DD Review" && !!row.proposedDisposition,
            canAddWorkNote: isOperations || (isOwner && actor?.globalRole !== "Viewer"),
        },
    };
}

export function createRecapWorkItemService({ repository = recapWorkItemRepository } = {}) {
    return {
        async admit(input, actor) {
            requireOperations(actor);
            const ids = Array.isArray(input?.intakeRequestIds) ? input.intakeRequestIds : [];
            if (!ids.length || ids.length > 500 || ids.some(id => !UUID.test(id))) throw new RecapWorkItemValidationError("Valid intake request IDs are required");
            const reviewed = new Map((Array.isArray(input.reviewedItems) ? input.reviewedItems : []).map(item => [item.intakeRequestId, item]));
            const items = ids.map(intakeRequestId => {
                const item = reviewed.get(intakeRequestId) || {};
                return {
                    intakeRequestId,
                    title: text(item.title, 512), description: text(item.description, 100000),
                    category: text(item.category, 128), team: text(item.team, 128),
                    priority: ["High", "Medium", "Low"].includes(item.priority) ? item.priority : null,
                    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate || "") ? item.dueDate : null,
                    communityNamesJson: Array.isArray(item.communityNames) ? JSON.stringify(item.communityNames.map(name => text(name, 255)).filter(Boolean)) : null,
                };
            });
            return (await repository.admit(items, actor.id)).map(row => mapRow(row, actor));
        },
        async list(actor) {
            const result = await repository.list();
            return { workItems: result.workItems.map(row => mapRow(row, actor)), assignees: result.assignees };
        },
        async assign(id, targetUserId, actor, expectedVersion) {
            requireOperations(actor);
            if (!UUID.test(id) || !targetUserId) throw new RecapWorkItemValidationError();
            return mapRow((await transition(() => repository.assign(id, String(targetUserId), actor.id, version(expectedVersion))))[0], actor);
        },
        async accept(id, actor, expectedVersion) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return mapRow((await transition(() => repository.accept(id, actor, version(expectedVersion))))[0], actor);
        },
        async submitForDdReview(id, actor, expectedVersion) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return mapRow((await transition(() => repository.submitForDdReview(id, actor, version(expectedVersion))))[0], actor);
        },
        async returnFromDdReview(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            const reason = text(input?.reason, 2000);
            return mapRow((await transition(() => repository.returnFromDdReview(id, actor, reason, version(input?.expectedVersion))))[0], actor);
        },
        async markReadyToPublish(id, actor, expectedVersion) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            return mapRow((await transition(() => repository.markReadyToPublish(id, actor, version(expectedVersion))))[0], actor);
        },
        async markNotMine(id, input, actor) {
            const cleanReason = text(input?.reason, 1000);
            if (!UUID.test(id) || !cleanReason) throw new RecapWorkItemValidationError();
            return mapRow((await transition(() => repository.markNotMine(id, cleanReason, actor, version(input?.expectedVersion))))[0], actor);
        },
        async updateResponse(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            const content = text(input?.responseContent, 100000);
            if (!content) throw new RecapWorkItemValidationError("Response content is required");
            await requireMutableOwner(repository, id, actor);
            return mapRow((await transition(() => repository.updateResponse(id, content, actor, version(input?.expectedVersion))))[0], actor);
        },
        async requestClarification(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            const reason = text(input?.reason, 2000);
            if (!reason) throw new RecapWorkItemValidationError("Clarification reason is required");
            await requireMutableOwner(repository, id, actor);
            return mapRow((await transition(() => repository.requestClarification(id, reason, actor, version(input?.expectedVersion))))[0], actor);
        },
        async resolveClarification(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            const resolution = text(input?.resolution, 2000);
            if (!resolution) throw new RecapWorkItemValidationError("Clarification resolution is required");
            return mapRow((await transition(() => repository.resolveClarification(id, resolution, actor, version(input?.expectedVersion))))[0], actor);
        },
        async block(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            const reason = text(input?.reason, 2000);
            if (!reason) throw new RecapWorkItemValidationError("Blocker reason is required");
            await requireMutableOwner(repository, id, actor);
            return mapRow((await transition(() => repository.block(id, reason, actor, version(input?.expectedVersion))))[0], actor);
        },
        async unblock(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            const resolution = text(input?.resolution, 2000);
            if (!resolution) throw new RecapWorkItemValidationError("Blocker resolution is required");
            return mapRow((await transition(() => repository.unblock(id, resolution, actor, version(input?.expectedVersion))))[0], actor);
        },
        async proposeDisposition(id, input, actor) {
            if (!UUID.test(id) || !["Not Applicable", "Duplicate"].includes(input?.disposition)) throw new RecapWorkItemValidationError("Valid disposition is required");
            const reason = text(input?.reason, 2000);
            if (!reason) throw new RecapWorkItemValidationError("Disposition reason is required");
            await requireMutableOwner(repository, id, actor);
            return mapRow((await transition(() => repository.proposeDisposition(id, input.disposition, reason, actor, version(input?.expectedVersion))))[0], actor);
        },
        async approveDisposition(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            return mapRow((await transition(() => repository.approveDisposition(id, actor, version(input?.expectedVersion))))[0], actor);
        },
        async returnDisposition(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            const reason = text(input?.reason, 2000);
            if (!reason) throw new RecapWorkItemValidationError("Disposition return reason is required");
            return mapRow((await transition(() => repository.returnDisposition(id, reason, actor, version(input?.expectedVersion))))[0], actor);
        },
        async listEvents(id) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return (await repository.listEvents(id)).map(row => {
                const { detailsJson, ...event } = row;
                return { ...event, details: detailsJson ? JSON.parse(detailsJson) : null };
            });
        },
        async listNotes(id) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return repository.listNotes(id);
        },
        async addNote(id, input, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            const noteText = text(input?.noteText, 4000);
            const noteType = ["Work Note", "Clarification", "Blocker", "Disposition"].includes(input?.noteType) ? input.noteType : "Work Note";
            if (!noteText) throw new RecapWorkItemValidationError("Work note text is required");
            if (!isOperationsActor(actor)) await requireMutableOwner(repository, id, actor);
            return (await repository.addNote(id, noteText, noteType, actor))[0];
        },
    };
}

export const recapWorkItemService = createRecapWorkItemService();
