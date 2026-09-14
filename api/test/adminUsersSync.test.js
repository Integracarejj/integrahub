import test from "node:test";
import assert from "node:assert/strict";
import { compareWithCmdb, isProtectedFromAbsenceDeactivation } from "../src/routes/adminUsers.js";

function user(id, role, overrides = {}) {
    return {
        id,
        entraObjectId: `${id}-entra`,
        email: `${id}@example.test`,
        displayName: id,
        role,
        isActive: true,
        canAccess: true,
        jobTitle: null,
        department: null,
        officeLocation: null,
        ...overrides,
    };
}

test("absence deactivation protects external portal roles and PlatformAdmin only", () => {
    const users = [
        user("buyer", "ExternalBuyer", { canAccess: false }),
        user("broker", "ExternalBroker"),
        user("admin", "PlatformAdmin"),
        user("editor", "Editor"),
        user("viewer", "Viewer"),
        user("inactive-buyer", "ExternalBuyer", { isActive: false }),
    ];

    const comparison = compareWithCmdb([], users);

    assert.deepEqual(comparison.wouldDeactivate.map(item => item.id), ["editor", "viewer"]);
    assert.deepEqual(comparison.skippedPlatformAdmins.map(item => item.id), ["admin"]);
    assert.equal(users[0].isActive, true);
    assert.equal(users[0].canAccess, false);
    assert.equal(users[5].isActive, false);
    assert.equal(isProtectedFromAbsenceDeactivation("ExternalBuyer"), true);
    assert.equal(isProtectedFromAbsenceDeactivation("ExternalBroker"), true);
    assert.equal(isProtectedFromAbsenceDeactivation("PlatformAdmin"), true);
    assert.equal(isProtectedFromAbsenceDeactivation("Editor"), false);
    assert.equal(isProtectedFromAbsenceDeactivation("externalbuyer"), false);
});

test("present external users retain existing candidate matching and update planning", () => {
    const broker = user("broker", "ExternalBroker", {
        email: "broker@integracare.com",
        displayName: "Before",
        jobTitle: "Before title",
    });
    const candidate = {
        graphId: "broker-entra",
        normalizedEmail: "broker@integracare.com",
        displayName: "After",
        jobTitle: "After title",
        department: null,
        officeLocation: null,
    };

    const comparison = compareWithCmdb([candidate], [broker]);

    assert.equal(comparison.wouldDeactivate.length, 0);
    assert.equal(comparison.wouldUpdate.length, 1);
    assert.deepEqual(comparison.wouldUpdate[0].changes, {
        displayName: { from: "Before", to: "After" },
        jobTitle: { from: "Before title", to: "After title" },
    });
    assert.equal(broker.isActive, true);
    assert.equal(broker.canAccess, true);
});

test("the sync run consumes the same wouldDeactivate plan used by preview", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../src/routes/adminUsers.js", import.meta.url), "utf8"));
    assert.match(source, /for \(const eu of comparison\.wouldDeactivate\)/);
});
