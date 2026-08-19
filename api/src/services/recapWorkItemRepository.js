import { query as defaultQuery } from "../db.js";

const joinedSelect = `
    SELECT CONVERT(varchar(36), workItem.id) AS workItemId,
           CONVERT(varchar(36), workItem.intakeRequestId) AS intakeRequestId,
           workItem.requestNumber, workItem.status, workItem.assignedUserId,
           assignedUser.displayName AS assignedUserName, assignedUser.email AS assignedUserEmail,
           workItem.team, workItem.priority, workItem.dueDate, workItem.title,
           workItem.description, workItem.category, workItem.communityNamesJson,
           workItem.needsReassignment, workItem.misassignedReason,
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
    return {
        async admit(items) {
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

                INSERT INTO cmdb.RecapWorkItems
                    (id, intakeRequestId, requestNumber, status, team, priority, dueDate,
                     title, description, category, communityNamesJson)
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
            `, { itemsJson: JSON.stringify(items), itemCount: items.length });
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

        async assign(id, targetUserId, actorId) {
            return query(`
                IF NOT EXISTS (SELECT 1 FROM cmdb.Users WHERE id = @targetUserId AND isActive = 1 AND canAccess = 1 AND role IN ('PlatformAdmin', 'Editor', 'Viewer', 'DDTeam'))
                    THROW 51003, 'Eligible internal user not found', 1;
                UPDATE cmdb.RecapWorkItems SET assignedUserId = @targetUserId,
                    assignedByUserId = @actorId, assignedAt = SYSUTCDATETIME(), acceptedAt = NULL,
                    status = 'Assigned', needsReassignment = 0, misassignedReason = NULL,
                    updatedAt = SYSUTCDATETIME()
                WHERE id = @id;
                IF @@ROWCOUNT = 0 THROW 51004, 'Work item not found', 1;
                ${joinedSelect} WHERE workItem.id = @id;
            `, { id, targetUserId, actorId });
        },

        async accept(id, actor) {
            return query(`
                UPDATE cmdb.RecapWorkItems
                SET status = 'In Progress', acceptedAt = COALESCE(acceptedAt, SYSUTCDATETIME()), updatedAt = SYSUTCDATETIME()
                WHERE id = @id AND assignedUserId IS NOT NULL
                  AND (assignedUserId = @actorId OR @isOperations = 1)
                  AND status IN ('Assigned', 'In Progress');
                IF @@ROWCOUNT = 0 THROW 51005, 'Work item cannot be accepted', 1;
                ${joinedSelect} WHERE workItem.id = @id;
            `, { id, actorId: actor.id, isOperations: ["PlatformAdmin", "DDTeam"].includes(actor.globalRole) });
        },

        async markNotMine(id, reason, actor) {
            return query(`
                UPDATE cmdb.RecapWorkItems
                SET assignedUserId = NULL, assignedByUserId = NULL, assignedAt = NULL,
                    acceptedAt = NULL, status = 'Queued', needsReassignment = 1,
                    misassignedReason = @reason, updatedAt = SYSUTCDATETIME()
                WHERE id = @id AND assignedUserId IS NOT NULL
                  AND (assignedUserId = @actorId OR @isOperations = 1);
                IF @@ROWCOUNT = 0 THROW 51006, 'Work item cannot be reassigned', 1;
                ${joinedSelect} WHERE workItem.id = @id;
            `, { id, reason, actorId: actor.id, isOperations: ["PlatformAdmin", "DDTeam"].includes(actor.globalRole) });
        },
    };
}

export const recapWorkItemRepository = createRecapWorkItemRepository();
