import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "../db.js";

const publicationSelect = `SELECT TOP (1) publication.id, publication.workItemId, publication.publicationNumber,
    publication.operationKey, publication.targetExternalOrganizationId, publication.status,
    publication.publishedByUserId, publication.publishedAt, publication.partnerActorUserId,
    publication.partnerActorOrganizationId, publication.partnerActionAt, publication.partnerGuidance, publication.contentSnapshotJson,
    CONVERT(varchar(18), publication.version, 1) AS version
    FROM cmdb.RecapPublications publication`;

const externalPublicationSelect = `SELECT publication.id, publication.workItemId, publication.publicationNumber, publication.status,
    publication.publishedAt, publication.partnerActionAt, publication.partnerGuidance, publication.contentSnapshotJson,
    CONVERT(varchar(18), publication.version, 1) AS version,
    workItem.requestNumber, workItem.title, workItem.description, workItem.status AS workItemStatus,
    requestRow.intakePackageId, requestRow.sourceRowNumber,
    transactionRow.businessTransactionId, transactionRow.name AS transactionName,
    publication.targetExternalOrganizationId
    FROM cmdb.RecapPublications publication
    INNER JOIN cmdb.RecapWorkItems workItem ON workItem.id = publication.workItemId
    INNER JOIN cmdb.RecapIntakeRequests requestRow ON requestRow.id = workItem.intakeRequestId
    INNER JOIN cmdb.RecapIntakePackages packageRow ON packageRow.id = requestRow.intakePackageId
    INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = packageRow.recapTransactionId`;

export function createRecapPublicationRepository({ query = defaultQuery, generateUuid = randomUUID } = {}) {
    return {
        async getInternalContext(workItemId) {
            const rows = await query(`SELECT CONVERT(varchar(36), workItem.id) AS workItemId, workItem.requestNumber,
                    workItem.title, workItem.status, workItem.assignedUserId,
                    CONVERT(varchar(18), workItem.version, 1) AS workItemVersion,
                    transactionRow.businessTransactionId, transactionRow.name AS transactionName,
                    transactionRow.owningExternalOrganizationId
                FROM cmdb.RecapWorkItems workItem
                INNER JOIN cmdb.RecapIntakeRequests requestRow ON requestRow.id = workItem.intakeRequestId
                INNER JOIN cmdb.RecapIntakePackages packageRow ON packageRow.id = requestRow.intakePackageId
                INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = packageRow.recapTransactionId
                WHERE workItem.id = @workItemId`, { workItemId });
            return rows[0] || null;
        },
        async getByOperation(workItemId, operationKey) {
            const rows = await query(`${publicationSelect} WHERE publication.workItemId = @workItemId AND publication.operationKey = @operationKey`, { workItemId, operationKey });
            return rows[0] || null;
        },
        async begin(context, operationKey, actorUserId, expectedVersion) {
            const publicationId = generateUuid();
            const rows = await query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
                DECLARE @publicationNumber INT;
                SELECT @publicationNumber = ISNULL(MAX(publicationNumber), 0) + 1 FROM cmdb.RecapPublications WITH (UPDLOCK, HOLDLOCK) WHERE workItemId = @workItemId;
                IF NOT EXISTS (SELECT 1 FROM cmdb.RecapWorkItems WITH (UPDLOCK, HOLDLOCK)
                    WHERE id = @workItemId AND status = 'Ready to Publish' AND version = CONVERT(binary(8), @expectedVersion, 1))
                    OR EXISTS (SELECT 1 FROM cmdb.RecapPublications WHERE workItemId = @workItemId AND status IN ('Pending', 'Published'))
                    BEGIN ROLLBACK; THROW 51074, 'Publication cannot be started or is stale', 1; END;
                INSERT INTO cmdb.RecapPublications (id, workItemId, publicationNumber, operationKey, targetExternalOrganizationId, publishedByUserId, contentSnapshotJson)
                SELECT @publicationId, @workItemId, @publicationNumber, @operationKey, @targetExternalOrganizationId, @actorUserId,
                    (SELECT workItem.requestNumber, workItem.title, workItem.description, workItem.responseContent,
                        transactionRow.businessTransactionId, transactionRow.name AS transactionName
                     FROM cmdb.RecapWorkItems workItem
                     INNER JOIN cmdb.RecapIntakeRequests requestRow ON requestRow.id = workItem.intakeRequestId
                     INNER JOIN cmdb.RecapIntakePackages packageRow ON packageRow.id = requestRow.intakePackageId
                     INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = packageRow.recapTransactionId
                     WHERE workItem.id = @workItemId FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER);
                INSERT INTO cmdb.RecapPublishedArtifacts (publicationId, artifactId, sourceDriveId, sourceItemId, storedFileName)
                SELECT @publicationId, id, driveId, itemId, storedFileName FROM cmdb.RecapWorkArtifacts
                WHERE workItemId = @workItemId AND status = 'Uploaded' AND publicationEligibility = 'Active';
                INSERT INTO cmdb.RecapWorkItemEvents (workItemId, eventType, actorUserId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, detailsJson)
                SELECT id, 'PublicationStarted', @actorUserId, status, status, assignedUserId, assignedUserId,
                    (SELECT @publicationId AS publicationId, @publicationNumber AS publicationNumber, @targetExternalOrganizationId AS targetExternalOrganizationId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
                FROM cmdb.RecapWorkItems WHERE id = @workItemId;
                COMMIT;
                ${publicationSelect} WHERE publication.id = @publicationId`, {
                publicationId, workItemId: context.workItemId, operationKey,
                targetExternalOrganizationId: context.owningExternalOrganizationId, actorUserId, expectedVersion,
            });
            return rows[0] || null;
        },
        async listArtifacts(publicationId) {
            return query(`SELECT published.publicationId, published.artifactId, published.sourceDriveId, published.sourceItemId,
                    published.storedFileName, published.knowledgeSiteId, published.knowledgeDriveId,
                    published.knowledgeItemId, published.storedContentSize, published.storedContentSha256, published.status,
                    artifact.originalFileName, artifact.contentType
                FROM cmdb.RecapPublishedArtifacts published
                INNER JOIN cmdb.RecapWorkArtifacts artifact ON artifact.id = published.artifactId
                WHERE published.publicationId = @publicationId ORDER BY artifact.createdAt, artifact.id`, { publicationId });
        },
        async recordReceipt(publicationId, artifactId, identity) {
            await query(`UPDATE cmdb.RecapPublishedArtifacts SET status = 'Receipt', knowledgeSiteId = @knowledgeSiteId,
                    knowledgeDriveId = @knowledgeDriveId, knowledgeItemId = @knowledgeItemId, knowledgeWebUrl = @knowledgeWebUrl,
                    updatedAt = SYSUTCDATETIME()
                WHERE publicationId = @publicationId AND artifactId = @artifactId AND status = 'Pending'`, { publicationId, artifactId, ...identity });
        },
        async activateArtifact(publicationId, artifactId, identity) {
            await query(`UPDATE cmdb.RecapPublishedArtifacts SET status = 'Active',
                    storedContentSize = @storedContentSize, storedContentSha256 = @storedContentSha256, updatedAt = SYSUTCDATETIME()
                WHERE publicationId = @publicationId AND artifactId = @artifactId AND status = 'Receipt'
                  AND knowledgeDriveId = @knowledgeDriveId AND knowledgeItemId = @knowledgeItemId`,
                { publicationId, artifactId, ...identity });
        },
        async complete(publicationId, actorUserId) {
            const rows = await query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
                IF EXISTS (SELECT 1 FROM cmdb.RecapPublishedArtifacts WHERE publicationId = @publicationId AND status <> 'Active')
                    BEGIN ROLLBACK; THROW 51075, 'Publication artifacts are incomplete', 1; END;
                DECLARE @workItemId UNIQUEIDENTIFIER;
                SELECT @workItemId = workItemId FROM cmdb.RecapPublications WITH (UPDLOCK, HOLDLOCK) WHERE id = @publicationId AND status = 'Pending';
                IF @workItemId IS NULL BEGIN ROLLBACK; THROW 51076, 'Publication cannot be completed', 1; END;
                UPDATE cmdb.RecapPublications SET status = 'Published', publishedAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME() WHERE id = @publicationId;
                DECLARE @priorStatus VARCHAR(24); DECLARE @assignedUserId VARCHAR(255);
                SELECT @priorStatus = status, @assignedUserId = assignedUserId FROM cmdb.RecapWorkItems WHERE id = @workItemId;
                UPDATE cmdb.RecapWorkItems SET status = 'Waiting Partner Review', updatedAt = SYSUTCDATETIME() WHERE id = @workItemId AND status = 'Ready to Publish';
                IF @@ROWCOUNT = 0 BEGIN ROLLBACK; THROW 51077, 'Work item publication state is inconsistent', 1; END;
                INSERT INTO cmdb.RecapWorkItemEvents (workItemId, eventType, actorUserId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, detailsJson)
                VALUES (@workItemId, 'PublishedExternal', @actorUserId, @priorStatus, 'Waiting Partner Review', @assignedUserId, @assignedUserId,
                    (SELECT @publicationId AS publicationId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));
                COMMIT;
                ${publicationSelect} WHERE publication.id = @publicationId`, { publicationId, actorUserId });
            return rows[0] || null;
        },
        async listForExternalUser(userId, businessTransactionId = null) {
            return query(`${externalPublicationSelect}
                WHERE publication.status IN ('Published', 'Approved', 'Rework Requested')
                  AND (@businessTransactionId IS NULL OR transactionRow.businessTransactionId = @businessTransactionId)
                  AND EXISTS (SELECT 1 FROM cmdb.ExternalUserOrganizations membership WHERE membership.userId = @userId
                    AND membership.externalOrganizationId = publication.targetExternalOrganizationId)
                  AND NOT EXISTS (SELECT 1 FROM cmdb.RecapPublications laterPublication
                    WHERE laterPublication.workItemId = publication.workItemId
                      AND laterPublication.publicationNumber > publication.publicationNumber
                      AND laterPublication.status IN ('Published', 'Approved', 'Rework Requested'))
                ORDER BY publication.publishedAt DESC`, { userId, businessTransactionId });
        },
        async getExternalPublication(userId, publicationId) {
            const rows = await query(`${externalPublicationSelect}
                WHERE publication.id = @publicationId AND publication.status IN ('Published', 'Approved', 'Rework Requested')
                  AND EXISTS (SELECT 1 FROM cmdb.ExternalUserOrganizations membership WHERE membership.userId = @userId
                    AND membership.externalOrganizationId = publication.targetExternalOrganizationId)`, { userId, publicationId });
            return rows[0] || null;
        },
        async getExternalArtifact(userId, publicationId, artifactId) {
            const rows = await query(`SELECT published.knowledgeDriveId, published.knowledgeItemId, published.storedFileName,
                    published.storedContentSize, published.storedContentSha256, artifact.originalFileName, artifact.contentType
                FROM cmdb.RecapPublishedArtifacts published
                INNER JOIN cmdb.RecapPublications publication ON publication.id = published.publicationId
                INNER JOIN cmdb.RecapWorkArtifacts artifact ON artifact.id = published.artifactId
                WHERE published.publicationId = @publicationId AND published.artifactId = @artifactId AND published.status = 'Active'
                  AND publication.status IN ('Published', 'Approved', 'Rework Requested')
                  AND EXISTS (SELECT 1 FROM cmdb.ExternalUserOrganizations membership WHERE membership.userId = @userId
                    AND membership.externalOrganizationId = publication.targetExternalOrganizationId)`, { userId, publicationId, artifactId });
            return rows[0] || null;
        },
        async partnerAction(publicationId, userId, organizationId, action, guidance, expectedVersion) {
            const approved = action === "approve";
            const status = approved ? "Approved" : "Rework Requested";
            const workStatus = approved ? "Completed" : "In Progress";
            const eventType = approved ? "PartnerApproved" : "PartnerRequestedRework";
            const rows = await query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
                DECLARE @workItemId UNIQUEIDENTIFIER; DECLARE @assignedUserId VARCHAR(255); DECLARE @priorStatus VARCHAR(24);
                SELECT @workItemId = publication.workItemId FROM cmdb.RecapPublications publication WITH (UPDLOCK, HOLDLOCK)
                WHERE publication.id = @publicationId AND publication.status = 'Published'
                  AND publication.targetExternalOrganizationId = @organizationId
                  AND publication.version = CONVERT(binary(8), @expectedVersion, 1)
                  AND EXISTS (SELECT 1 FROM cmdb.ExternalUserOrganizations membership WHERE membership.userId = @userId AND membership.externalOrganizationId = @organizationId);
                IF @workItemId IS NULL BEGIN ROLLBACK; THROW 51078, 'Partner action cannot be applied or is stale', 1; END;
                SELECT @priorStatus = status, @assignedUserId = assignedUserId FROM cmdb.RecapWorkItems WHERE id = @workItemId;
                UPDATE cmdb.RecapPublications SET status = @status, partnerActorUserId = @userId,
                    partnerActorOrganizationId = @organizationId, partnerActionAt = SYSUTCDATETIME(), partnerGuidance = @guidance,
                    updatedAt = SYSUTCDATETIME() WHERE id = @publicationId;
                UPDATE cmdb.RecapWorkItems SET status = @workStatus, updatedAt = SYSUTCDATETIME() WHERE id = @workItemId AND status = 'Waiting Partner Review';
                IF @@ROWCOUNT = 0 BEGIN ROLLBACK; THROW 51079, 'Partner action work item state is inconsistent', 1; END;
                INSERT INTO cmdb.RecapWorkItemEvents (workItemId, eventType, actorUserId, priorStatus, resultingStatus, priorAssignedUserId, resultingAssignedUserId, detailsJson)
                VALUES (@workItemId, @eventType, @userId, @priorStatus, @workStatus, @assignedUserId, @assignedUserId,
                    (SELECT @publicationId AS publicationId, @organizationId AS externalOrganizationId, @guidance AS guidance FOR JSON PATH, WITHOUT_ARRAY_WRAPPER));
                COMMIT;
                ${publicationSelect} WHERE publication.id = @publicationId`, {
                publicationId, userId, organizationId, action, guidance, expectedVersion, status, workStatus, eventType,
            });
            return rows[0] || null;
        },
    };
}

export const recapPublicationRepository = createRecapPublicationRepository();
