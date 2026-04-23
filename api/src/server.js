import "dotenv/config";
import express from "express";
import { query, closePool } from "./db.js";
import applicationsRouter from "./routes/applications.js";
import capabilitiesRouter from "./routes/capabilities.js";
import integrationsRouter from "./routes/integrations.js";
import meRouter from "./routes/me.js";
import { resolveCurrentUser } from "./middleware/resolveCurrentUser.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "dist");

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

app.use(resolveCurrentUser);

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

app.use("/api/applications", applicationsRouter);
app.use("/api/capabilities", capabilitiesRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/me", meRouter);

app.use((req, res, next) => {
    if (req.path.startsWith("/health")) return next();

    const indexPath = path.join(distPath, "index.html");
    if (existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }

    res.status(404).send("Frontend not built or dist folder missing");
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
