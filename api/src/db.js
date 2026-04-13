import sql from "mssql";

let pool = null;
let initializing = false;
let initPromise = null;

export async function getPool() {
    if (pool && pool.connected) {
        return pool;
    }

    if (initPromise) {
        return initPromise;
    }

    const dbUser = process.env.DB_USER;
    const dbPass = process.env.DB_PASS;
    const server = process.env.AZURE_SQL_SERVER;
    const database = process.env.AZURE_SQL_DATABASE;

    if (!dbUser || !dbPass || !server || !database) {
        throw new Error("Missing SQL configuration: DB_USER, DB_PASS, AZURE_SQL_SERVER, AZURE_SQL_DATABASE must be set");
    }

    console.log("Connecting to database...");

    initPromise = (async () => {
        try {
            if (pool) {
                try { await pool.close(); } catch (_) {}
                pool = null;
            }

            pool = new sql.ConnectionPool({
                server,
                database,
                user: dbUser,
                password: dbPass,
                options: {
                    encrypt: true,
                    trustServerCertificate: false,
                    connectionTimeout: 30000,
                    idleTimeout: 300000,
                },
            });

            await pool.connect();
            console.log("DB connection successful");
            return pool;
        } catch (err) {
            pool = null;
            console.error("DB connection failed:", err.message);
            throw err;
        } finally {
            initPromise = null;
        }
    })();

    return initPromise;
}

export async function query(statement, params = {}) {
    const pool = await getPool();
    const request = pool.request();
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    const result = await request.query(statement);
    return result.recordset;
}

export async function closePool() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}
