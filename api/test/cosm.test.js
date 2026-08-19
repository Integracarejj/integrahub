import test from "node:test";
import assert from "node:assert/strict";
import { requireInternalUser } from "../src/middleware/authorization.js";
import { getCosmModuleInfo } from "../src/routes/cosm.js";

function invokeBoundary(user) {
    let statusCode = 200;
    let body;
    let allowed = false;
    const response = { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } };
    requireInternalUser({ user }, response, () => { allowed = true; });
    return { statusCode, body, allowed };
}

test("COSM module response is minimal and non-sensitive", () => {
    let body;
    getCosmModuleInfo({}, { json(value) { body = value; return this; } });
    assert.deepEqual(body, { ok: true, module: "cosm" });
    assert.equal(JSON.stringify(body).includes("sharepoint"), false);
    assert.equal(JSON.stringify(body).includes("token"), false);
});

test("COSM boundary allows existing internal roles", () => {
    for (const globalRole of ["PlatformAdmin", "Editor", "Viewer", "DDTeam"]) assert.equal(invokeBoundary({ globalRole }).allowed, true);
});

test("COSM boundary denies external-only roles", () => {
    for (const globalRole of ["ExternalBroker", "ExternalBuyer"]) {
        const result = invokeBoundary({ globalRole });
        assert.equal(result.statusCode, 403);
        assert.equal(result.allowed, false);
        assert.deepEqual(result.body, { error: "Access denied. Internal user access required." });
    }
});

test("COSM boundary requires authentication", () => {
    const result = invokeBoundary(undefined);
    assert.equal(result.statusCode, 401);
    assert.equal(result.allowed, false);
    assert.deepEqual(result.body, { error: "Authentication required" });
});
