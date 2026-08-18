import express from "express";

export const INTAKE_JSON_LIMIT = "1mb";
export const INTAKE_PATH_PATTERN = /^\/api\/portal\/recapitalization\/transactions\/[^/]+\/intake\/?$/;

export function configureJsonBodyParsing(app) {
    // This must run before the default parser. Once a request body has been
    // parsed, the later global parser safely skips it.
    app.use(INTAKE_PATH_PATTERN, express.json({ limit: INTAKE_JSON_LIMIT }));
    app.use(express.json());
}

export function jsonBodyErrorHandler(error, _req, res, next) {
    if (error?.type === "entity.too.large") {
        return res.status(413).json({ error: `Intake payload exceeds the ${INTAKE_JSON_LIMIT} limit` });
    }
    return next(error);
}
