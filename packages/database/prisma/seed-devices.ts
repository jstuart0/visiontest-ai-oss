// VisionTest AI - Built-in Device Profiles Seed
// Seeds the database with common mobile device profiles

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUILT_IN_DEVICES = [
  // iOS Devices
  {
    name: 'iPhone 15 Pro',
    platform: 'IOS' as const,
    width: 390,
    height: 844,
    scaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    osVersion: '17.0',
    isEmulator: true,
    config: {
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 15 Pro',
    },
    isBuiltIn: true,
  },
  {
    name: 'iPhone 15 Pro Max',
    platform: 'IOS' as const,
    width: 430,
    height: 932,
    scaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    osVersion: '17.0',
    isEmulator: true,
    config: {
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 15 Pro Max',
    },
    isBuiltIn: true,
  },
  {
    name: 'iPhone SE',
    platform: 'IOS' as const,
    width: 375,
    height: 667,
    scaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    osVersion: '17.0',
    isEmulator: true,
    config: {
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone SE (3rd generation)',
    },
    isBuiltIn: true,
  },
  {
    name: 'iPad Pro 11"',
    platform: 'IOS' as const,
    width: 834,
    height: 1194,
    scaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    osVersion: '17.0',
    isEmulator: true,
    config: {
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPad Pro 11-inch (4th generation)',
    },
    isBuiltIn: true,
  },
  // Android Devices
  {
    name: 'Pixel 8',
    platform: 'ANDROID' as const,
    width: 412,
    height: 915,
    scaleFactor: 2.625,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    osVersion: '14',
    isEmulator: true,
    config: {
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Pixel 8',
      'appium:avd': 'Pixel_8_API_34',
    },
    isBuiltIn: true,
  },
  {
    name: 'Galaxy S24',
    platform: 'ANDROID' as const,
    width: 360,
    height: 780,
    scaleFactor: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    osVersion: '14',
    isEmulator: true,
    config: {
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Galaxy S24',
    },
    isBuiltIn: true,
  },
  {
    name: 'Galaxy Tab S9',
    platform: 'ANDROID' as const,
    width: 800,
    height: 1280,
    scaleFactor: 1.5,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Safari/537.36',
    osVersion: '14',
    isEmulator: true,
    config: {
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Galaxy Tab S9',
    },
    isBuiltIn: true,
  },
  // Mobile Web (these are used for Playwright device emulation)
  {
    name: 'iPhone 15 Pro (Mobile Web)',
    platform: 'MOBILE_WEB' as const,
    width: 390,
    height: 844,
    scaleFactor: 3,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isEmulator: true,
    config: {
      isMobile: true,
      hasTouch: true,
      playwrightDevice: 'iPhone 15 Pro',
    },
    isBuiltIn: true,
  },
  {
    name: 'Pixel 8 (Mobile Web)',
    platform: 'MOBILE_WEB' as const,
    width: 412,
    height: 915,
    scaleFactor: 2.625,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    isEmulator: true,
    config: {
      isMobile: true,
      hasTouch: true,
      playwrightDevice: 'Pixel 8',
    },
    isBuiltIn: true,
  },
];

export async function seedDeviceProfiles(): Promise<void> {
  console.log('📱 Seeding built-in device profiles...');

  // Remove existing built-in profiles to avoid duplicates
  await prisma.deviceProfile.deleteMany({
    where: { isBuiltIn: true },
  });

  for (const device of BUILT_IN_DEVICES) {
    await prisma.deviceProfile.create({
      data: {
        projectId: null, // Global
        name: device.name,
        platform: device.platform,
        width: device.width,
        height: device.height,
        scaleFactor: device.scaleFactor,
        userAgent: device.userAgent,
        osVersion: device.osVersion || null,
        isEmulator: device.isEmulator,
        config: device.config,
        isBuiltIn: device.isBuiltIn,
      },
    });
  }

  console.log(`✅ Seeded ${BUILT_IN_DEVICES.length} built-in device profiles`);
}

// Run if called directly
if (require.main === module) {
  seedDeviceProfiles()
    .catch((e) => {
      console.error('❌ Device profile seeding failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
