const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://dev.aperion.health';

// Only attach the saved session if it exists, so `npm run excel:template` and
// dry runs work before anyone has logged in.
const AUTH_FILE = path.join(__dirname, 'auth', 'auth.json');
const storageState = fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined;

module.exports = defineConfig({
  testDir: './tests',
  // Recorded tests touch shared member data - run them one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // All three on every run: console, browsable HTML, and the Excel test case doc.
  // Keep these in the config rather than passing --reporter on the CLI - a CLI
  // --reporter REPLACES this list, which silently stops the HTML report updating.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./reporters/excel-reporter.js'],
  ],

  // Refreshes the saved access token before the suite runs (see scripts/refresh-auth.js).
  globalSetup: require.resolve('./scripts/global-setup.js'),

  use: {
    baseURL: BASE_URL,
    // Session captured by `npm run auth` (manual login). Never contains an OTP.
    ...(storageState ? { storageState } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
