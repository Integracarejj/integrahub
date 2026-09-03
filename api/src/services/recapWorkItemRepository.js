import { query as defaultQuery } from "../db.js";

const joinedSelect = `
    SELECT CONVERT(varchar(36), workItem.id) AS workItemId,
           CONVERT(varchar(36), workItem.intakeRequestId) AS intakeRequestId,
           workItem.requestNumber, workItem.status, workItem.assignedUserId,
           assignedUser.displayName AS assignedUserName, assignedUser.email AS assignedUserEmail,
           workItem.team, workItem.priority, workItem.dueDate, workItem.title,
           workItem.description, workItem.category, workItem.communityNamesJson,
           workItem.needsReassignment, workItem.misassignedReason,
           workItem.responseContent, workItem.responseUpdatedAt, workItem.responseUpdatedByUserId,
           workItem.activeReasonType, workItem.activeReason, workItem.proposedDisposition,
           workItem.dispositionReason, workItem.dispositionProposedByUserId, workItem.dispositionProposedAt,
           workItem.admittedAt, workItem.assignedAt, workItem.acceptedAt,
           workItem.updatedAt, CONVERT(varchar(18), workItem.version, 1) AS version,
           CONVERT(varchar(36), packageRow.id) AS packageId, packageRow.sourcePackageId,
           packageRow.packageName, packageRow.originalFileName,
           packageRow.externalOrganizationId,
           CONVERT(varchar(36), transactionRow.id) AS transactionDatabaseId,
           transactionRow.businessTransactionId, transactionRow.name AS transactionName
    FROM cmdb.RecapWorkItems workItem
    INNER JOIN cmdb.RecapIntakeRequests intakeRequest ON intakeRequest.id = workItem.intakeRequestId
    INNER JOIN cmdb.RecapIntakePackages packageRow ON packageRow.id = intakeRequest.intakePackageId
    INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = packageRow.recapTransactionId
    LEFT JOIN cmdb.Users assignedUser ON assignedUser.id = workItem.assignedUserId`;

export function createRecapWorkItemRepository({ query = defaultQuery } = {}) {
    const mutate = (id, actorId, expectedVersion, eventType, setClause, whereClause, values = {}, detailsJson = null) => query(`
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
        DECLARE @change TABLE (priorStatus VARCHAR(24), resultingStatus VARCHAR(24), priorAssignedUserId VARCHAR(255), resultingAssignedUserId VARCHAR(255));
        UPDATE workItem SET ${setClause}, updatedAt = SYSUTCDATETIME()
        OUTPUT deleted.status, inserted.status, deleted.assignedUserId, inserted.assignedUserId INTO @change
        FROM cmdb.RecapWorkItems workItem
        WHERE workItem.id = @id AND (${whereClause})
          AND workItem.version = CONVERT(binary(8), @expectedVersion, 1);
        IF @@ROWCOUNT = 0 BEGIN ROLLBACK; THROW 51070, 'Work item transition cannot be applied or is stale', 1; END;
        INSERT INTO cmdb.RecapWorkItemEvents (workItemId, eventType, actorUserId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, detailsJson)
        SELECT @id, '${eventType}', @actorId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, @detailsJson FROM @change;
        COMMIT TRANSACTION;
        ${joinedSelect} WHERE workItem.id = @id;
    `, { id, actorId, expectedVersion: expectedVersion || null, detailsJson, ...values });

    return {
        async admit(items, actorId) {
            return query(`
                SET XACT_ABORT ON;
                BEGIN TRANSACTION;
                DECLARE @items TABLE (
                    intakeRequestId UNIQUEIDENTIFIER PRIMARY KEY, title NVARCHAR(512) NULL,
                    description NVARCHAR(MAX) NULL, category NVARCHAR(128) NULL,
                    team NVARCHAR(128) NULL, priority VARCHAR(8) NULL, dueDate DATE NULL,
                    communityNamesJson NVARCHAR(MAX) NULL
                );
                INSERT INTO @items
                SELECT intakeRequestId, title, description, category, team, priority,
                       TRY_CONVERT(date, dueDate), communityNamesJson
                FROM OPENJSON(@itemsJson) WITH (
                    intakeRequestId UNIQUEIDENTIFIER '$.intakeRequestId', title NVARCHAR(512) '$.title',
                    description NVARCHAR(MAX) '$.description', category NVARCHAR(128) '$.category',
                    team NVARCHAR(128) '$.team', priority VARCHAR(8) '$.priority',
                    dueDate NVARCHAR(10) '$.dueDate', communityNamesJson NVARCHAR(MAX) '$.communityNamesJson'
                );
                IF (SELECT COUNT(*) FROM @items) <> @itemCount
                BEGIN ROLLBACK; THROW 51001, 'Invalid or duplicate intake request IDs', 1; END;
                IF EXISTS (SELECT 1 FROM @items item LEFT JOIN cmdb.RecapIntakeRequests sourceRow ON sourceRow.id = item.intakeRequestId WHERE sourceRow.id IS NULL)
                BEGIN ROLLBACK; THROW 51002, 'Intake request not found', 1; END;

                DECLARE @admitted TABLE (workItemId UNIQUEIDENTIFIER, resultingStatus VARCHAR(24));
                INSERT INTO cmdb.RecapWorkItems
                    (id, intakeRequestId, requestNumber, status, team, priority, dueDate,
                     title, description, category, communityNamesJson)
                OUTPUT inserted.id, inserted.status INTO @admitted
                SELECT NEWID(), sourceRow.id,
                       CONCAT('DD-', DATEPART(year, SYSUTCDATETIME()), '-', RIGHT(REPLICATE('0', 8) + CONVERT(varchar(20), NEXT VALUE FOR cmdb.RecapWorkItemNumberSequence), 8)),
                       'Queued', COALESCE(item.team, sourceRow.team),
                       COALESCE(item.priority, sourceRow.priority), COALESCE(item.dueDate, sourceRow.dueDate),
                       COALESCE(NULLIF(item.title, ''), sourceRow.title),
                       COALESCE(item.description, sourceRow.description),
                       COALESCE(NULLIF(item.category, ''), sourceRow.category),
                       CASE WHEN ISJSON(item.communityNamesJson) = 1 THEN item.communityNamesJson ELSE sourceRow.communityNamesJson END
                FROM @items item
                INNER JOIN cmdb.RecapIntakeRequests sourceRow ON sourceRow.id = item.intakeRequestId
                WHERE NOT EXISTS (
                    SELECT 1 FROM cmdb.RecapWorkItems existing WITH (UPDLOCK, HOLDLOCK)
                    WHERE existing.intakeRequestId = sourceRow.id
                );

                INSERT INTO cmdb.RecapWorkItemEvents (workItemId, eventType, actorUserId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, detailsJson)
                SELECT workItemId, 'Admitted', @actorId, NULL, resultingStatus, NULL, NULL, NULL FROM @admitted;

                UPDATE packageRow
                SET status = CASE WHEN EXISTS (
                    SELECT 1 FROM cmdb.RecapIntakeRequests sourceRow
                    WHERE sourceRow.intakePackageId = packageRow.id
                      AND NOT EXISTS (SELECT 1 FROM cmdb.RecapWorkItems workItem WHERE workItem.intakeRequestId = sourceRow.id)
                ) THEN 'Awaiting Review' ELSE 'Converted' END,
                    updatedAt = SYSUTCDATETIME()
                FROM cmdb.RecapIntakePackages packageRow
                WHERE EXISTS (
                    SELECT 1 FROM cmdb.RecapIntakeRequests sourceRow
                    INNER JOIN @items item ON item.intakeRequestId = sourceRow.id
                    WHERE sourceRow.intakePackageId = packageRow.id
                );
                COMMIT TRANSACTION;
                ${joinedSelect}
                WHERE workItem.intakeRequestId IN (SELECT intakeRequestId FROM @items)
                ORDER BY workItem.requestNumber;
            `, { itemsJson: JSON.stringify(items), itemCount: items.length, actorId });
        },

        async list() {
            const workItems = await query(`${joinedSelect} ORDER BY workItem.admittedAt DESC, workItem.requestNumber;`);
            const assignees = await query(`
                SELECT id, displayName, email, role FROM cmdb.Users
                WHERE isActive = 1 AND canAccess = 1 AND role IN ('PlatformAdmin', 'Editor', 'Viewer', 'DDTeam')
                ORDER BY displayName, email;
            `);
            return { workItems, assignees };
        },

        async get(id) {
            return (await query(`${joinedSelect} WHERE workItem.id = @id;`, { id }))[0] || null;
        },

        async assign(id, targetUserId, actorId, expectedVersion) {
            return query(`
                SET XACT_ABORT ON;
                BEGIN TRANSACTION;
                IF NOT EXISTS (SELECT 1 FROM cmdb.Users WHERE id = @targetUserId AND isActive = 1 AND canAccess = 1 AND role IN ('PlatformAdmin', 'Editor', 'Viewer', 'DDTeam'))
                BEGIN ROLLBACK; THROW 51003, 'Eligible internal user not found', 1; END;
                DECLARE @change TABLE (priorStatus VARCHAR(24), resultingStatus VARCHAR(24), previousAssignedUserId VARCHAR(255));
                UPDATE cmdb.RecapWorkItems SET assignedUserId = @targetUserId,
                    assignedByUserId = @actorId, assignedAt = SYSUTCDATETIME(), acceptedAt = NULL,
                    status = CASE WHEN status IN ('Queued', 'Assigned', 'In Progress') THEN 'Assigned' ELSE status END,
                    needsReassignment = 0, misassignedReason = NULL,
                    updatedAt = SYSUTCDATETIME()
                OUTPUT deleted.status, inserted.status, deleted.assignedUserId INTO @change
                WHERE id = @id AND status IN ('Queued', 'Assigned', 'In Progress', 'Clarification Needed', 'Blocked')
                  AND version = CONVERT(binary(8), @expectedVersion, 1);
                IF @@ROWCOUNT = 0 BEGIN ROLLBACK; THROW 51004, 'Work item cannot be assigned or is stale', 1; END;
                INSERT INTO cmdb.RecapWorkItemEvents (workItemId, eventType, actorUserId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, detailsJson)
                SELECT @id, CASE WHEN previousAssignedUserId IS NULL THEN 'Assigned' ELSE 'Reassigned' END, @actorId,
                       priorStatus, resultingStatus, previousAssignedUserId, @targetUserId,
                       (SELECT previousAssignedUserId, @targetUserId AS assignedUserId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
                FROM @change;
                COMMIT TRANSACTION;
                ${joinedSelect} WHERE workItem.id = @id;
            `, { id, targetUserId, actorId, expectedVersion: expectedVersion || null });
        },

        async accept(id, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "Accepted", "status = 'In Progress', acceptedAt = SYSUTCDATETIME()", "workItem.assignedUserId = @actorId AND workItem.status = 'Assigned'");
        },

        async submitForDdReview(id, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "SubmittedForDdReview", "status = 'Needs DD Review'", "workItem.assignedUserId = @actorId AND workItem.status = 'In Progress' AND workItem.proposedDisposition IS NULL");
        },

        async returnFromDdReview(id, actor, reason, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "ReturnedFromDdReview", "status = 'In Progress'", "workItem.assignedUserId IS NOT NULL AND workItem.status = 'Needs DD Review' AND workItem.proposedDisposition IS NULL", {}, reason ? JSON.stringify({ reason }) : null);
        },

        async markReadyToPublish(id, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "MarkedReadyToPublish", "status = 'Ready to Publish'", "workItem.assignedUserId IS NOT NULL AND workItem.status = 'Needs DD Review' AND workItem.proposedDisposition IS NULL");
        },

        async markNotMine(id, reason, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "MarkedNotMine",
                "assignedUserId = NULL, assignedByUserId = NULL, assignedAt = NULL, acceptedAt = NULL, status = 'Queued', needsReassignment = 1, misassignedReason = @reason",
                "workItem.assignedUserId IS NOT NULL AND workItem.status IN ('Assigned', 'In Progress') AND (workItem.assignedUserId = @actorId OR @isOperations = 1)",
                { reason, isOperations: ["PlatformAdmin", "DDTeam"].includes(actor.globalRole) }, JSON.stringify({ reason }));
        },

        async updateResponse(id, responseContent, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "ResponseUpdated",
                "responseContent = @responseContent, responseUpdatedAt = SYSUTCDATETIME(), responseUpdatedByUserId = @actorId",
                "workItem.assignedUserId = @actorId AND workItem.status = 'In Progress'", { responseContent });
        },
        async requestClarification(id, reason, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "ClarificationRequested",
                "status = 'Clarification Needed', activeReasonType = 'Clarification', activeReason = @reason",
                "workItem.assignedUserId = @actorId AND workItem.status = 'In Progress'", { reason }, JSON.stringify({ reason }));
        },
        async resolveClarification(id, resolution, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "ClarificationResolved",
                "status = 'In Progress', activeReasonType = NULL, activeReason = NULL",
                "workItem.assignedUserId IS NOT NULL AND workItem.status = 'Clarification Needed'", {}, JSON.stringify({ resolution }));
        },
        async block(id, reason, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "Blocked",
                "status = 'Blocked', activeReasonType = 'Blocker', activeReason = @reason",
                "workItem.assignedUserId = @actorId AND workItem.status = 'In Progress'", { reason }, JSON.stringify({ reason }));
        },
        async unblock(id, resolution, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "Unblocked",
                "status = 'In Progress', activeReasonType = NULL, activeReason = NULL",
                "workItem.assignedUserId IS NOT NULL AND workItem.status = 'Blocked'", {}, JSON.stringify({ resolution }));
        },
        async proposeDisposition(id, disposition, reason, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "DispositionProposed",
                "status = 'Needs DD Review', proposedDisposition = @disposition, dispositionReason = @reason, dispositionProposedByUserId = @actorId, dispositionProposedAt = SYSUTCDATETIME()",
                "workItem.assignedUserId = @actorId AND workItem.status = 'In Progress'", { disposition, reason }, JSON.stringify({ disposition, reason }));
        },
        async approveDisposition(id, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "DispositionApproved",
                "status = proposedDisposition",
                "workItem.status = 'Needs DD Review' AND workItem.proposedDisposition IN ('Not Applicable', 'Duplicate')", {}, null);
        },
        async returnDisposition(id, reason, actor, expectedVersion) {
            return mutate(id, actor.id, expectedVersion, "DispositionReturned",
                "status = 'In Progress', proposedDisposition = NULL, dispositionReason = NULL, dispositionProposedByUserId = NULL, dispositionProposedAt = NULL",
                "workItem.assignedUserId IS NOT NULL AND workItem.status = 'Needs DD Review' AND workItem.proposedDisposition IS NOT NULL", {}, JSON.stringify({ reason }));
        },
        async listEvents(id) {
            return query(`SELECT CONVERT(varchar(36), eventRow.id) AS id, CONVERT(varchar(36), eventRow.workItemId) AS workItemId,
                eventRow.eventType, eventRow.actorUserId, actor.displayName AS actorName, eventRow.occurredAt,
                eventRow.priorStatus, eventRow.resultingStatus, eventRow.priorAssignedUserId, eventRow.resultingAssignedUserId, eventRow.detailsJson
                FROM cmdb.RecapWorkItemEvents eventRow LEFT JOIN cmdb.Users actor ON actor.id = eventRow.actorUserId
                WHERE eventRow.workItemId = @id ORDER BY eventRow.occurredAt, eventRow.id;`, { id });
        },
        async listNotes(id) {
            return query(`SELECT CONVERT(varchar(36), note.id) AS id, CONVERT(varchar(36), note.workItemId) AS workItemId,
                note.authorUserId, author.displayName AS authorName, note.noteType, note.noteText, note.createdAt
                FROM cmdb.RecapWorkNotes note LEFT JOIN cmdb.Users author ON author.id = note.authorUserId
                WHERE note.workItemId = @id ORDER BY note.createdAt, note.id;`, { id });
        },
        async addNote(id, noteText, noteType, actor) {
            return query(`
                IF NOT EXISTS (SELECT 1 FROM cmdb.RecapWorkItems WHERE id = @id AND (assignedUserId = @actorId OR @isOperations = 1))
                    THROW 51071, 'Work note access denied', 1;
                INSERT INTO cmdb.RecapWorkNotes (workItemId, authorUserId, noteType, noteText)
                OUTPUT CONVERT(varchar(36), inserted.id) AS id, CONVERT(varchar(36), inserted.workItemId) AS workItemId,
                    inserted.authorUserId, inserted.noteType, inserted.noteText, inserted.createdAt
                VALUES (@id, @actorId, @noteType, @noteText);`,
                { id, actorId: actor.id, isOperations: ["PlatformAdmin", "DDTeam"].includes(actor.globalRole), noteType, noteText });
        },
    };
}

export const recapWorkItemRepository = createRecapWorkItemRepository();
