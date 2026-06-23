/**
 * example/.detoxrc.js
 *
 * Copy this file to your project root and update:
 *   - binaryPath  → path to your built .app / .apk
 *   - bundleId    → your app's bundle identifier (iOS only)
 *   - device type → your simulator / emulator name
 *
 * Build commands:
 *   iOS debug:     npx detox build -c ios.sim.debug
 *   Android debug: npx detox build -c android.emu.debug
 *
 * Run commands:
 *   npx detox test -c ios.sim.debug example/login.test.ts
 *   npx detox test -c android.emu.debug example/login.test.ts
 */

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'example/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },

  apps: {
    // ── iOS ──────────────────────────────────────────────────────────────────
    'ios.debug': {
      type: 'ios.app',
      // Path to the built .app bundle — relative to project root
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/YourApp.app',
      // Bundle identifier from Xcode / Info.plist
      bundleId: 'com.yourcompany.yourapp',
      build: [
        'xcodebuild',
        '-workspace ios/YourApp.xcworkspace',
        '-scheme YourApp',
        '-configuration Debug',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
      ].join(' '),
    },

    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/YourApp.app',
      bundleId: 'com.yourcompany.yourapp',
      build: [
        'xcodebuild',
        '-workspace ios/YourApp.xcworkspace',
        '-scheme YourApp',
        '-configuration Release',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
      ].join(' '),
    },

    // ── Android ──────────────────────────────────────────────────────────────
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      // Package name from AndroidManifest.xml
      bundleId: 'com.yourcompany.yourapp',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081], // Metro bundler port
    },

    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      bundleId: 'com.yourcompany.yourapp',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },

  devices: {
    // ── iOS Simulator ─────────────────────────────────────────────────────────
    simulator: {
      type: 'ios.simulator',
      device: {
        // Run `xcrun simctl list devices` to see available simulators
        type: 'iPhone 15 Pro',
        os: 'iOS 17.0', // optional — omit to use latest available
      },
    },

    // ── Android Emulator ──────────────────────────────────────────────────────
    emulator: {
      type: 'android.emulator',
      device: {
        // Run `emulator -list-avds` to see available AVDs
        avdName: 'Pixel_7_API_34',
      },
    },

    // ── Physical Android device ───────────────────────────────────────────────
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*', // matches any connected device
      },
    },
  },

  configurations: {
    'ios.sim.debug':      { device: 'simulator', app: 'ios.debug' },
    'ios.sim.release':    { device: 'simulator', app: 'ios.release' },
    'android.emu.debug':  { device: 'emulator',  app: 'android.debug' },
    'android.emu.release':{ device: 'emulator',  app: 'android.release' },
    'android.att.debug':  { device: 'attached',  app: 'android.debug' },
  },
};
