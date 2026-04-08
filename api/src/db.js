import sql from "mssql";
import { ClientSecretCredential } from "@azure/identity";

let pool = null;

export async function getPool() {
    if (pool) {
        return pool;
    }

    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const server = process.env.AZURE_SQL_SERVER;
    const database = process.env.AZURE_SQL_DATABASE;

    if (!tenantId || !clientId || !clientSecret || !server || !database) {
        throw new Error("Missing Azure AD configuration: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SQL_SERVER, AZURE_SQL_DATABASE must be set");
    }

    console.log("Attempting DB connection with Azure AD authentication...");

    try {
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

        const tokenResponse = await credential.getToken("https://database.windows.net/.default");
        const accessToken = tokenResponse.token;

        pool = new sql.ConnectionPool({
            server,
            database,
            authentication: {
                type: "azure-active-directory-access-token",
                options: {
                    accessToken,
                },
            },
            options: {
                encrypt: true,
                trustServerCertificate: false,
            },
        });

        await pool.connect();
        console.log("DB connection successful");
        return pool;
    } catch (err) {
        pool = null;
        console.error("DB connection failed:", err.message);
        throw err;
    }
}

export async function query(statement) {
    const p = await getPool();
    const result = await p.request().query(statement);
    return result.recordset;
}

export async function closePool() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}
