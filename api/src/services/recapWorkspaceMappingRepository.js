import sql from "mssql";
import { getPool as defaultGetPool, query as defaultQuery, queryInTransaction as defaultQueryInTransaction } from "../db.js";

const SELECT_MAPPING = `
    SELECT recapTransactionId, siteKey, siteId, driveId, rootItemId,
           folderName, webUrl, createdAt, updatedAt
    FROM cmdb.RecapTransactionSharePointWorkspaces
`;

export class WorkspaceProvisioningLockError extends Error {
    constructor() {
        super("Workspace provisioning is already in progress");
        this.name = "WorkspaceProvisioningLockError";
    }
}

export function createRecapWorkspaceMappingRepository({
    query = defaultQuery,
    getPool = defaultGetPool,
    queryInTransaction = defaultQueryInTransaction,
    createTransaction = (pool) => new sql.Transaction(pool),
} = {}) {
    const repository = {
        async withProvisioningLock(recapTransactionId, siteKey, work) {
            const transaction = createTransaction(await getPool());
            await transaction.begin();
            try {
                const rows = await queryInTransaction(transaction, `
                    DECLARE @result INT;
                    EXEC @result = sys.sp_getapplock
                        @Resource = @resource,
                        @LockMode = 'Exclusive',
                        @LockOwner = 'Transaction',
                        @LockTimeout = 15000;
                    SELECT @result AS lockResult;
                `, { resource: `recap-workspace:${siteKey}:${recapTransactionId}` });
                if (!rows[0] || rows[0].lockResult < 0) throw new WorkspaceProvisioningLockError();
                const result = await work();
                await transaction.commit();
                return result;
            } catch (error) {
                try { await transaction.rollback(); } catch {
                    // Preserve the original provisioning or lock error.
                }
                throw error;
            }
        },

        async getByTransaction(recapTransactionId, siteKey = "working") {
            const rows = await query(`${SELECT_MAPPING}
                WHERE recapTransactionId = @recapTransactionId AND siteKey = @siteKey
            `, { recapTransactionId, siteKey });
            return rows[0] || null;
        },

        async createOrGet(mapping) {
            try {
                await query(`
                    INSERT INTO cmdb.RecapTransactionSharePointWorkspaces
                        (recapTransactionId, siteKey, siteId, driveId, rootItemId, folderName, webUrl)
                    VALUES
                        (@recapTransactionId, @siteKey, @siteId, @driveId, @rootItemId, @folderName, @webUrl)
                `, mapping);
            } catch (error) {
                const number = error?.number ?? error?.originalError?.info?.number;
                if (number !== 2601 && number !== 2627) throw error;
            }
            return repository.getByTransaction(mapping.recapTransactionId, mapping.siteKey);
        },

        async refreshLocation(recapTransactionId, siteKey, { folderName, webUrl }) {
            await query(`
                UPDATE cmdb.RecapTransactionSharePointWorkspaces
                SET folderName = @folderName, webUrl = @webUrl,
                    updatedAt = SYSUTCDATETIME()
                WHERE recapTransactionId = @recapTransactionId AND siteKey = @siteKey
            `, { recapTransactionId, siteKey, folderName, webUrl });
        },
    };
    return repository;
}

export const recapWorkspaceMappingRepository = createRecapWorkspaceMappingRepository();
