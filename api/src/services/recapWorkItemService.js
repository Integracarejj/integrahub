import { recapWorkItemRepository } from "./recapWorkItemRepository.js";

export class RecapWorkItemValidationError extends Error {}
export class RecapWorkItemConflictError extends Error {}
export class RecapWorkItemAuthorizationError extends Error {}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max) => value == null ? null : String(value).trim().slice(0, max);
const isOperationsActor = actor => ["PlatformAdmin", "DDTeam"].includes(actor?.globalRole);

function requireOperations(actor) {
    if (!isOperationsActor(actor)) throw new RecapWorkItemAuthorizationError("DD Operations access required");
}

function mapRow(row, actor) {
    const isOperations = isOperationsActor(actor);
    const isOwner = !!actor?.id && row.assignedUserId === actor.id;
    return {
        ...row,
        communities: JSON.parse(row.communityNamesJson || "[]"),
        communityNamesJson: undefined,
        needsReassignment: !!row.needsReassignment,
        capabilities: {
            canAssign: isOperations && row.status === "Queued", canAccept: row.status === "Assigned" && isOwner,
            canMarkNotMine: !!row.assignedUserId && (isOwner || isOperations), canReassign: isOperations && !!row.assignedUserId,
            canClarify: false, canBlock: false,
            canSubmitForDdReview: row.status === "In Progress" && !!actor?.id && row.assignedUserId === actor.id,
            canComplete: false,
            canReturnFromDdReview: isOperations && row.status === "Needs DD Review" && !!row.assignedUserId,
            canMarkReadyToPublish: isOperations && row.status === "Needs DD Review" && !!row.assignedUserId,
            canPublish: false,
            canUploadArtifact: isOwner && row.status === "In Progress",
            canViewArtifacts: (isOwner || isOperations) && !!row.assignedUserId,
            canDownloadArtifacts: (isOwner || isOperations) && !!row.assignedUserId,
            canMarkDuplicate: false, canMarkNotApplicable: false,
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
            return (await repository.admit(items)).map(row => mapRow(row, actor));
        },
        async list(actor) {
            const result = await repository.list();
            return { workItems: result.workItems.map(row => mapRow(row, actor)), assignees: result.assignees };
        },
        async assign(id, targetUserId, actor) {
            requireOperations(actor);
            if (!UUID.test(id) || !targetUserId) throw new RecapWorkItemValidationError();
            return mapRow((await repository.assign(id, String(targetUserId), actor.id))[0], actor);
        },
        async accept(id, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return mapRow((await repository.accept(id, actor))[0], actor);
        },
        async submitForDdReview(id, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return mapRow((await repository.submitForDdReview(id, actor))[0], actor);
        },
        async returnFromDdReview(id, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            return mapRow((await repository.returnFromDdReview(id))[0], actor);
        },
        async markReadyToPublish(id, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            requireOperations(actor);
            return mapRow((await repository.markReadyToPublish(id))[0], actor);
        },
        async markNotMine(id, reason, actor) {
            const cleanReason = text(reason, 1000);
            if (!UUID.test(id) || !cleanReason) throw new RecapWorkItemValidationError();
            return mapRow((await repository.markNotMine(id, cleanReason, actor))[0], actor);
        },
    };
}

export const recapWorkItemService = createRecapWorkItemService();
