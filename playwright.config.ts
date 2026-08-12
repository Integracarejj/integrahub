import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const WORKERS = process.env.CI ? 3 : Number(process.env.PLAYWRIGHT_WORKERS || 1);

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
 * Workflow state lives in each test's isolated browser context. CI runs spec
 * files concurrently; local runs default to one worker because Edge contention
 * on the supported Windows workstation is slower than serial execution. Set
 * PLAYWRIGHT_WORKERS to opt into local concurrency.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: WORKERS,
    reporter: [["list"], ["html", { open: "never" }]],
    outputDir: "test-results",
    timeout: 180_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL: BASE_URL,
        channel: process.env.CI ? undefined : "msedge",
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
