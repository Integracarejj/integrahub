import express from "express";
import { query, closePool } from "./db.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");

const app = express();
const PORT = process.env.PORT || 8080;

console.log(`Current working directory: ${process.cwd()}`);
console.log(`Resolved dist path: ${distPath}`);

if (existsSync(distPath)) {
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
} else {
    console.log("dist folder not found - frontend assets not served");
}

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

app.get(/^\/(?!health(?:\/|$)).*/, (_req, res) => {
    const indexPath = path.join(distPath, "index.html");
    if (existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Frontend not built or dist folder missing");
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
