import { Router } from "express";
import { query } from "../db.js";

const router = Router();

function requirePlatformAdmin(req, res, next) {
    if (!req.user || req.user.globalRole !== "PlatformAdmin") {
        return res.status(403).json({ error: "Access denied. PlatformAdmin required." });
    }
    return next();
}

router.use(requirePlatformAdmin);

function normalizeName(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/\.com$/g, "")
        .replace(/\bwebsite\b/gi, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function fuzzyMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    const common = aWords.filter(w => bWords.includes(w));
    const longer = Math.max(aWords.length, bWords.length);
    return longer > 0 && common.length / longer >= 0.5;
}

function computeBusinessCriticality(row) {
    const criticalKeywords = ["critical", "61+", "61_plus"];
    if (criticalKeywords.some(k => (row.numberOfUsers || "").toLowerCase().includes(k))) {
        return "Critical";
    }
    const highRisks = ["High", "high"];
    if (highRisks.includes(row.confidentialityRisk) ||
        highRisks.includes(row.integrityRisk) ||
        highRisks.includes(row.availabilityRisk)) {
        return "High";
    }
    const mediumRisks = ["Medium", "medium"];
    if (mediumRisks.includes(row.confidentialityRisk) ||
        mediumRisks.includes(row.integrityRisk) ||
        mediumRisks.includes(row.availabilityRisk)) {
        return "Medium";
    }
    return "Low";
}

function computeImpactIfDown(row) {
    const parts = [];
    if (row.category) parts.push(row.category);
    const risk = row.confidentialityRisk || row.integrityRisk || row.availabilityRisk;
    if (risk) parts.push(`${risk} risk`);
    if (row.numberOfUsers) {
        const band = row.numberOfUsers.replace(/[()]/g, "");
        parts.push(`${band} users`);
    }
    return parts.length > 0 ? parts.join(" — ") : "";
}

function suggestCapability(category, capabilities) {
    if (!category) return null;
    const cat = category.toLowerCase().trim();

    const map = {
        "hr": ["hr", "human resources", "learning", "talent", "people"],
        "crm": ["crm", "sales", "marketing", "customer relationship"],
        "marketing": ["marketing", "sales", "crm"],
        "financial services": ["financial", "fin", "finance", "accounting"],
        "operations": ["operations", "operational", "facilities"],
        "resident wellness": ["wellness", "clinical", "resident care", "health", "medical"],
        "lms": ["learning", "hr", "training", "lms"],
    };

    const keywords = map[cat] || [cat];

    for (const kw of keywords) {
        const match = capabilities.find(c =>
            c.name.toLowerCase().includes(kw)
        );
        if (match) return { id: match.id, name: match.name };
    }

    return null;
}

function suggestType(row) {
    const name = (row.application || "").toLowerCase();
    const website = (row.website || "").toLowerCase();
    if (website && (website.includes("saas") || website.includes(".com"))) return "SaaS";
    if (name.includes("saas") || name.includes("portal") || name.includes("cloud")) return "SaaS";
    if (row.vendor && row.vendor.trim()) return "SaaS";
    return "Standard";
}

const SYSTEM_CATEGORY_MAP = {
    "hr": "HR / Employee Engagement",
    "payroll": "HR / Payroll",
    "learning": "Learning Management",
    "lms": "Learning Management",
    "crm": "CRM / Sales",
    "sales": "Sales / Marketing",
    "marketing": "Marketing Tool",
    "financial": "Financial / Accounting",
    "accounting": "Financial / Accounting",
    "clinical": "Clinical / Resident Care",
    "pharmacy": "Clinical / Pharmacy",
    "emar": "Clinical / eMAR",
    "safety": "Clinical / Resident Safety",
    "wellness": "Clinical / Resident Engagement",
    "resident": "Clinical / Resident Care",
    "workforce": "Workforce Management",
    "identity": "Identity & Access",
    "analytics": "Analytics & Reporting",
    "reporting": "Analytics & Reporting",
    "collaboration": "Collaboration / Document Management",
    "document": "Collaboration / Document Management",
    "vendor": "Vendor Portal",
    "portal": "Vendor Portal",
    "infrastructure": "Infrastructure Platform",
    "platform": "Infrastructure Platform",
    "utility": "Utility / Admin Tool",
    "admin": "Utility / Admin Tool",
    "enterprise": "Enterprise System",
};

function suggestSystemCategory(row) {
    const category = (row.category || "").toLowerCase().trim();
    const name = (row.application || "").toLowerCase().trim();

    if (category && SYSTEM_CATEGORY_MAP[category]) {
        return SYSTEM_CATEGORY_MAP[category];
    }

    for (const [keyword, categoryName] of Object.entries(SYSTEM_CATEGORY_MAP)) {
        if (name.includes(keyword)) {
            return categoryName;
        }
    }

    return null;
}

router.post("/import-preview", async (req, res) => {
    try {
        const rows = req.body;

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: "Request body must be a non-empty JSON array" });
        }

        const existingApps = await query(`
            SELECT id, name, vendor, capabilityId, businessOwner, technicalOwner, businessCriticality, status
            FROM cmdb.Applications
            ORDER BY name
        `);

        const capabilities = await query(`
            SELECT id, name
            FROM cmdb.Capabilities
            ORDER BY name
        `);

        const existingNames = existingApps.map(a => ({
            ...a,
            normalizedName: normalizeName(a.name),
        }));

        const exactMatches = [];
        const likelyMatches = [];
        const wouldCreate = [];
        const wouldUpdate = [];
        const needsReview = [];

        for (const row of rows) {
            if (!row.application) {
                needsReview.push({
                    row,
                    reason: "Missing application name",
                });
                continue;
            }

            const registryName = row.application.trim();
            const normalizedRegistryName = normalizeName(registryName);
            const suggestedCap = suggestCapability(row.category, capabilities);

            const suggestedSysCat = suggestSystemCategory(row);

            const fields = {
                name: registryName,
                vendor: row.vendor || "",
                description: row.description || "",
                businessOwner: row.owner || "",
                status: "Active",
                type: suggestType(row),
                systemCategory: suggestedSysCat,
                businessCriticality: computeBusinessCriticality(row),
                impactIfDown: computeImpactIfDown(row),
                backupOwner: row.ownerBackup || "",
                dataClassification: row.dataClassification || "",
                capabilityId: suggestedCap?.id || null,
                capabilityName: suggestedCap?.name || null,
                notes: row.comments || "",
                userCountBand: row.numberOfUsers || "",
            };

            let matched = false;

            for (const existing of existingNames) {
                if (normalizedRegistryName === existing.normalizedName) {
                    exactMatches.push({
                        registryRow: fields,
                        existingApplication: {
                            id: existing.id,
                            name: existing.name,
                            vendor: existing.vendor,
                            capabilityId: existing.capabilityId,
                            businessOwner: existing.businessOwner,
                            technicalOwner: existing.technicalOwner,
                            businessCriticality: existing.businessCriticality,
                            status: existing.status,
                        },
                    });
                    matched = true;
                    break;
                }
            }

            if (matched) continue;

            for (const existing of existingNames) {
                if (fuzzyMatch(normalizedRegistryName, existing.normalizedName)) {
                    likelyMatches.push({
                        registryRow: fields,
                        existingApplication: {
                            id: existing.id,
                            name: existing.name,
                            vendor: existing.vendor,
                            capabilityId: existing.capabilityId,
                            businessOwner: existing.businessOwner,
                            technicalOwner: existing.technicalOwner,
                            businessCriticality: existing.businessCriticality,
                            status: existing.status,
                        },
                    });
                    matched = true;
                    break;
                }
            }

            if (matched) continue;

            wouldCreate.push({
                registryRow: fields,
                suggestedCapability: suggestedCap,
            });
        }

        return res.json({
            summary: {
                totalRows: rows.length,
                exactMatches: exactMatches.length,
                likelyMatches: likelyMatches.length,
                wouldCreate: wouldCreate.length,
                wouldUpdate: wouldUpdate.length,
                needsReview: needsReview.length,
            },
            exactMatches: exactMatches.slice(0, 20),
            likelyMatches: likelyMatches.slice(0, 20),
            wouldCreate: wouldCreate.slice(0, 20),
            wouldUpdate: wouldUpdate.slice(0, 20),
            needsReview: needsReview.slice(0, 20),
        });
    } catch (err) {
        console.error("POST /api/admin/applications/import-preview failed:", err);
        return res.status(500).json({ error: "Import preview failed", details: err.message });
    }
});

export default router;
