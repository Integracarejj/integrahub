import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Local Playwright harness for the IntegraIQ application.
 *
 * Uses the machine's installed Microsoft Edge via channel "msedge" so no
 * Playwright browser download is required (corporate environment constraint).
 *
 * The app gates all routes behind /api/me. The e2e helpers intercept that
 * request in-browser (see e2e/helpers/auth.ts) and answer with a
 * PlatformAdmin preview user, so the app runs fully locally with the
 * frontend only — no Azure/API backend required.
 *
 * One worker on purpose: the application keeps workflow state in
 * localStorage/runtime mock stores per browser context.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: 1,
    reporter: [["list"], ["html", { open: "never" }]],
    outputDir: "test-results",
    timeout: 180_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL: BASE_URL,
        channel: "msedge",
        headless: true,
        viewport: { width: 1440, height: 900 },
        actionTimeout: 20_000,
        navigationTimeout: 30_000,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        video: "retain-on-failure",
    },
    webServer: {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
    },
    projects: [
        {
            name: "edge-chromium",
            use: { ...devices["Desktop Edge"] },
        },
    ],
});
