/**
 * example/jest.config.js
 *
 * Jest configuration for running greybox example tests.
 * This config is referenced by .detoxrc.js testRunner.args.config.
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  // Root is the project root (two levels up from example/)
  rootDir: '../..',

  // Match both .ts and .js test files inside the example folder
  testMatch: [
    '<rootDir>/packages/greybox/example/**/*.test.ts',
    '<rootDir>/packages/greybox/example/**/*.test.js',
  ],

  // Transpile TypeScript via babel-jest (uses the project's babel.config.js)
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  // Detox requires tests to run serially — no parallel workers
  maxWorkers: 1,

  // Give each test plenty of time — AI inference can be slow on first run
  testTimeout: 180000,

  // Detox-required test environment and lifecycle hooks
  globalSetup:    'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testEnvironment: 'detox/runners/jest/testEnvironment',
  reporters: [
    'detox/runners/jest/reporter',
    // Optionally add jest-allure2-reporter for native Allure integration:
    // ['jest-allure2-reporter', { resultsDir: 'test-results/allure-results' }],
  ],

  verbose: true,
};
