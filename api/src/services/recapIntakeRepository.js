import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "../db.js";

export function createRecapIntakeRepository({ query = defaultQuery, generateUuid = randomUUID } = {}) {
    return {
        async persistPackage(values) {
            const packageId = generateUuid();
            const requests = values.requests.map((request, index) => ({
                id: generateUuid(), sourceRowNumber: index + 1, ...request,
            }));
            const rows = await query(`
                SET XACT_ABORT ON;
                BEGIN TRANSACTION;

                DECLARE @packageId UNIQUEIDENTIFIER;
                SELECT @packageId = id
                FROM cmdb.RecapIntakePackages WITH (UPDLOCK, HOLDLOCK)
                WHERE recapTransactionId = @recapTransactionId AND sourcePackageId = @sourcePackageId;

                IF @packageId IS NULL
                BEGIN
                    SET @packageId = @newPackageId;
                    INSERT INTO cmdb.RecapIntakePackages
                        (id, recapTransactionId, sourcePackageId, packageName, originalFileName,
                         requestCount, submittedBy, submittedByName, submittedByEmail, externalOrganizationId)
                    VALUES
                        (@packageId, @recapTransactionId, @sourcePackageId, @packageName, @originalFileName,
                         @requestCount, @submittedBy, @submittedByName, @submittedByEmail, @externalOrganizationId);

                    INSERT INTO cmdb.RecapIntakeRequests
                        (id, intakePackageId, sourceRowNumber, category, title, description,
                         team, owner, priority, dueDate, communityNamesJson)
                    SELECT id, @packageId, sourceRowNumber, category, title, description,
                           team, owner, priority, TRY_CONVERT(date, dueDate), communityNamesJson
                    FROM OPENJSON(@requestsJson) WITH (
                        id UNIQUEIDENTIFIER '$.id', sourceRowNumber INT '$.sourceRowNumber',
                        category NVARCHAR(128) '$.category', title NVARCHAR(512) '$.title',
                        description NVARCHAR(MAX) '$.description', team NVARCHAR(128) '$.team',
                        owner NVARCHAR(255) '$.owner', priority VARCHAR(8) '$.priority',
                        dueDate NVARCHAR(10) '$.dueDate', communityNamesJson NVARCHAR(MAX) '$.communityNamesJson'
                    );
                END

                IF (SELECT requestCount FROM cmdb.RecapIntakePackages WHERE id = @packageId) <> @requestCount
                BEGIN
                    ROLLBACK TRANSACTION;
                    THROW 51000, 'Existing intake package request count does not match', 1;
                END

                COMMIT TRANSACTION;
                SELECT CONVERT(varchar(36), @packageId) AS id;
            `, {
                newPackageId: packageId,
                recapTransactionId: values.recapTransactionId,
                sourcePackageId: values.sourcePackageId,
                packageName: values.packageName,
                originalFileName: values.originalFileName,
                requestCount: requests.length,
                submittedBy: values.submittedBy,
                submittedByName: values.submittedByName,
                submittedByEmail: values.submittedByEmail,
                externalOrganizationId: values.externalOrganizationId,
                requestsJson: JSON.stringify(requests),
            });
            return { id: rows[0].id, created: rows[0].id.toLowerCase() === packageId.toLowerCase(), requestCount: requests.length };
        },

        async listPackages() {
            return query(`
                SELECT CONVERT(varchar(36), packageRow.id) AS packageId,
                       packageRow.sourcePackageId, packageRow.packageName, packageRow.originalFileName,
                       packageRow.requestCount, packageRow.status, packageRow.submittedBy,
                       packageRow.submittedByName, packageRow.submittedByEmail,
                       packageRow.externalOrganizationId, packageRow.createdAt,
                       transactionRow.businessTransactionId, transactionRow.name AS transactionName,
                       CONVERT(varchar(36), requestRow.id) AS intakeRequestId,
                       requestRow.sourceRowNumber, requestRow.category, requestRow.title,
                       requestRow.description, requestRow.team, requestRow.owner,
                       requestRow.priority, requestRow.dueDate, requestRow.communityNamesJson
                FROM cmdb.RecapIntakePackages packageRow
                INNER JOIN cmdb.RecapTransactions transactionRow ON transactionRow.id = packageRow.recapTransactionId
                LEFT JOIN cmdb.RecapIntakeRequests requestRow ON requestRow.intakePackageId = packageRow.id
                ORDER BY packageRow.createdAt DESC, requestRow.sourceRowNumber ASC
            `);
        },
    };
}

export const recapIntakeRepository = createRecapIntakeRepository();
