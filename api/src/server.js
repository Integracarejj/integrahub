import express from "express";
import { query, closePool } from "./db.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/health/db", async (_req, res) => {
    try {
        await query("SELECT 1 AS ok");
        res.json({ ok: true, db: true });
    } catch (err) {
        let sanitized = err.message;
        sanitized = sanitized.replace(/[A-Za-z0-9+/=]{32,}/g, "[token]");
        sanitized = sanitized.replace(/tenant[_\s-]?id/gi, "[tenant-id]");
        sanitized = sanitized.replace(/client[_\s-]?secret/gi, "[client-secret]");
        res.status(500).json({ ok: false, db: false, error: sanitized });
    }
});

const server = app.listen(PORT, () => {
    console.log(`CMDB API running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await closePool();
    server.close(() => {
        process.exit(0);
    });
});
