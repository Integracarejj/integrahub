import { recapWorkItemRepository } from "./recapWorkItemRepository.js";

export class RecapWorkItemValidationError extends Error {}
export class RecapWorkItemConflictError extends Error {}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max) => value == null ? null : String(value).trim().slice(0, max);

function mapRow(row, actor) {
    return {
        ...row,
        communities: JSON.parse(row.communityNamesJson || "[]"),
        communityNamesJson: undefined,
        needsReassignment: !!row.needsReassignment,
        capabilities: {
            canAssign: true, canAccept: row.status === "Assigned" && !!actor?.id && row.assignedUserId === actor.id,
            canMarkNotMine: !!row.assignedUserId, canReassign: true,
            canClarify: false, canBlock: false, canComplete: false, canPublish: false,
            canMarkDuplicate: false, canMarkNotApplicable: false,
        },
    };
}

export function createRecapWorkItemService({ repository = recapWorkItemRepository } = {}) {
    return {
        async admit(input) {
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
            return (await repository.admit(items)).map(row => mapRow(row));
        },
        async list(actor) {
            const result = await repository.list();
            return { workItems: result.workItems.map(row => mapRow(row, actor)), assignees: result.assignees };
        },
        async assign(id, targetUserId, actor) {
            if (!UUID.test(id) || !targetUserId) throw new RecapWorkItemValidationError();
            return mapRow((await repository.assign(id, String(targetUserId), actor.id))[0], actor);
        },
        async accept(id, actor) {
            if (!UUID.test(id)) throw new RecapWorkItemValidationError();
            return mapRow((await repository.accept(id, actor))[0], actor);
        },
        async markNotMine(id, reason, actor) {
            const cleanReason = text(reason, 1000);
            if (!UUID.test(id) || !cleanReason) throw new RecapWorkItemValidationError();
            return mapRow((await repository.markNotMine(id, cleanReason, actor))[0], actor);
        },
    };
}

export const recapWorkItemService = createRecapWorkItemService();
