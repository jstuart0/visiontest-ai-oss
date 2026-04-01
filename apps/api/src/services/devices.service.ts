// VisionTest AI - Device Profiles Service
// CRUD for device profiles + device discovery

import { prisma, Platform, Prisma } from '@visiontest/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/error';
import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateDeviceProfileInput {
  projectId?: string;
  name: string;
  platform: 'WEB' | 'IOS' | 'ANDROID' | 'MOBILE_WEB';
  width: number;
  height: number;
  scaleFactor?: number;
  userAgent?: string;
  osVersion?: string;
  isEmulator?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateDeviceProfileInput {
  name?: string;
  platform?: 'WEB' | 'IOS' | 'ANDROID' | 'MOBILE_WEB';
  width?: number;
  height?: number;
  scaleFactor?: number;
  userAgent?: string;
  osVersion?: string;
  isEmulator?: boolean;
  config?: Record<string, unknown>;
}

export interface ListDeviceProfilesOptions {
  projectId?: string;
  platform?: string;
  includeBuiltIn?: boolean;
  includeGlobal?: boolean;
}

export interface AvailableDevice {
  id: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  state: string;
  osVersion?: string;
  isEmulator: boolean;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class DevicesService {
  private seedingInProgress = false;

  /**
   * Ensure built-in device profiles exist (auto-seed on first access)
   */
  private async ensureBuiltInProfiles(): Promise<void> {
    if (this.seedingInProgress) return;

    const count = await prisma.deviceProfile.count({ where: { isBuiltIn: true } });
    if (count > 0) return;

    this.seedingInProgress = true;
    try {
      const BUILT_IN_DEVICES = [
        { name: 'iPhone 15 Pro', platform: 'IOS' as Platform, width: 390, height: 844, scaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', osVersion: '17.0', isEmulator: true, config: { 'appium:automationName': 'XCUITest', 'appium:deviceName': 'iPhone 15 Pro' } },
        { name: 'iPhone 15 Pro Max', platform: 'IOS' as Platform, width: 430, height: 932, scaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', osVersion: '17.0', isEmulator: true, config: { 'appium:automationName': 'XCUITest', 'appium:deviceName': 'iPhone 15 Pro Max' } },
        { name: 'iPhone SE', platform: 'IOS' as Platform, width: 375, height: 667, scaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', osVersion: '17.0', isEmulator: true, config: { 'appium:automationName': 'XCUITest', 'appium:deviceName': 'iPhone SE (3rd generation)' } },
        { name: 'iPad Pro 11"', platform: 'IOS' as Platform, width: 834, height: 1194, scaleFactor: 2, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', osVersion: '17.0', isEmulator: true, config: { 'appium:automationName': 'XCUITest', 'appium:deviceName': 'iPad Pro 11-inch (4th generation)' } },
        { name: 'Pixel 8', platform: 'ANDROID' as Platform, width: 412, height: 915, scaleFactor: 2.625, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36', osVersion: '14', isEmulator: true, config: { 'appium:automationName': 'UiAutomator2', 'appium:deviceName': 'Pixel 8', 'appium:avd': 'Pixel_8_API_34' } },
        { name: 'Galaxy S24', platform: 'ANDROID' as Platform, width: 360, height: 780, scaleFactor: 3, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36', osVersion: '14', isEmulator: true, config: { 'appium:automationName': 'UiAutomator2', 'appium:deviceName': 'Galaxy S24' } },
        { name: 'Galaxy Tab S9', platform: 'ANDROID' as Platform, width: 800, height: 1280, scaleFactor: 1.5, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Safari/537.36', osVersion: '14', isEmulator: true, config: { 'appium:automationName': 'UiAutomator2', 'appium:deviceName': 'Galaxy Tab S9' } },
        { name: 'iPhone 15 Pro (Mobile Web)', platform: 'MOBILE_WEB' as Platform, width: 390, height: 844, scaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isEmulator: true, config: { isMobile: true, hasTouch: true, playwrightDevice: 'iPhone 15 Pro' } },
        { name: 'Pixel 8 (Mobile Web)', platform: 'MOBILE_WEB' as Platform, width: 412, height: 915, scaleFactor: 2.625, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36', isEmulator: true, config: { isMobile: true, hasTouch: true, playwrightDevice: 'Pixel 8' } },
      ];

      for (const device of BUILT_IN_DEVICES) {
        await prisma.deviceProfile.create({
          data: {
            projectId: null,
            name: device.name,
            platform: device.platform,
            width: device.width,
            height: device.height,
            scaleFactor: device.scaleFactor,
            userAgent: device.userAgent,
            osVersion: device.osVersion || null,
            isEmulator: device.isEmulator,
            config: device.config as Prisma.InputJsonValue,
            isBuiltIn: true,
          },
        });
      }

      logger.info(`Auto-seeded ${BUILT_IN_DEVICES.length} built-in device profiles`);
    } catch (err) {
      logger.error('Failed to auto-seed device profiles:', err);
    } finally {
      this.seedingInProgress = false;
    }
  }

  /**
   * List device profiles (built-in + project custom)
   */
  async list(options: ListDeviceProfilesOptions = {}): Promise<any[]> {
    // Auto-seed built-in profiles if none exist
    if (options.includeBuiltIn !== false) {
      await this.ensureBuiltInProfiles();
    }

    const where: any = {};
    const conditions: any[] = [];

    // Include global (projectId = null) built-in profiles
    if (options.includeGlobal !== false) {
      conditions.push({ projectId: null });
    }

    // Include project-specific profiles
    if (options.projectId) {
      conditions.push({ projectId: options.projectId });
    }

    if (conditions.length > 0) {
      where.OR = conditions;
    }

    if (options.platform) {
      where.platform = options.platform;
    }

    const profiles = await prisma.deviceProfile.findMany({
      where,
      orderBy: [
        { isBuiltIn: 'desc' },
        { platform: 'asc' },
        { name: 'asc' },
      ],
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    return profiles;
  }

  /**
   * Get a device profile by ID
   */
  async getById(id: string): Promise<any> {
    const profile = await prisma.deviceProfile.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!profile) {
      throw NotFoundError('DeviceProfile');
    }

    return profile;
  }

  /**
   * Create a custom device profile
   */
  async create(input: CreateDeviceProfileInput): Promise<any> {
    // Validate project exists if specified
    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw BadRequestError('Project not found');
      }
    }

    const profile = await prisma.deviceProfile.create({
      data: {
        projectId: input.projectId || null,
        name: input.name,
        platform: input.platform as Platform,
        width: input.width,
        height: input.height,
        scaleFactor: input.scaleFactor || 1.0,
        userAgent: input.userAgent,
        osVersion: input.osVersion,
        isEmulator: input.isEmulator ?? true,
        config: (input.config || {}) as Prisma.InputJsonValue,
        isBuiltIn: false,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    logger.info(`Device profile created: ${profile.id} (${profile.name})`);
    return profile;
  }

  /**
   * Update a device profile (only custom profiles, not built-in)
   */
  async update(id: string, input: UpdateDeviceProfileInput): Promise<any> {
    const existing = await prisma.deviceProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw NotFoundError('DeviceProfile');
    }

    if (existing.isBuiltIn) {
      throw BadRequestError('Cannot modify built-in device profiles');
    }

    const profile = await prisma.deviceProfile.update({
      where: { id },
      data: {
        name: input.name,
        platform: input.platform as Platform | undefined,
        width: input.width,
        height: input.height,
        scaleFactor: input.scaleFactor,
        userAgent: input.userAgent,
        osVersion: input.osVersion,
        isEmulator: input.isEmulator,
        config: input.config as Prisma.InputJsonValue | undefined,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    logger.info(`Device profile updated: ${profile.id}`);
    return profile;
  }

  /**
   * Delete a device profile (only custom profiles)
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.deviceProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw NotFoundError('DeviceProfile');
    }

    if (existing.isBuiltIn) {
      throw BadRequestError('Cannot delete built-in device profiles');
    }

    await prisma.deviceProfile.delete({
      where: { id },
    });

    logger.info(`Device profile deleted: ${id}`);
  }

  /**
   * Discover available devices (connected simulators/emulators)
   * Note: This requires the API server to have access to xcrun/adb commands,
   * which is typically only available when running locally or on a build machine.
   */
  async discoverDevices(): Promise<AvailableDevice[]> {
    const devices: AvailableDevice[] = [];

    // Try to discover iOS simulators
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('xcrun simctl list devices -j 2>/dev/null');
      const data = JSON.parse(stdout);

      for (const [runtime, runtimeDevices] of Object.entries(data.devices || {})) {
        const osVersion = runtime
          .replace(/^com\.apple\.CoreSimulator\.SimRuntime\./, '')
          .replace(/-/g, '.')
          .replace('iOS.', 'iOS ');

        for (const device of runtimeDevices as any[]) {
          if (device.isAvailable) {
            devices.push({
              id: device.udid,
              name: device.name,
              platform: 'IOS',
              state: device.state?.toLowerCase() === 'booted' ? 'booted' : 'available',
              osVersion,
              isEmulator: true,
            });
          }
        }
      }
    } catch {
      // xcrun not available
    }

    // Try to discover Android emulators/devices
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('adb devices -l 2>/dev/null');
      const lines = stdout.trim().split('\n').slice(1);

      for (const line of lines) {
        const match = line.match(/^(emulator-\d+|[\w:.]+)\s+(device|offline)\s*(.*)/);
        if (match) {
          const [, id, state, details] = match;
          const modelMatch = details.match(/model:(\S+)/);
          devices.push({
            id,
            name: modelMatch?.[1] || id,
            platform: 'ANDROID',
            state: state === 'device' ? 'booted' : 'offline',
            isEmulator: id.startsWith('emulator-'),
          });
        }
      }
    } catch {
      // adb not available
    }

    return devices;
  }

  /**
   * Check if a device profile has the necessary capabilities for testing
   */
  async checkCapability(id: string): Promise<{
    capable: boolean;
    missing: string[];
    warnings: string[];
  }> {
    const profile = await this.getById(id);
    const missing: string[] = [];
    const warnings: string[] = [];

    if (profile.platform === 'IOS') {
      if (!profile.osVersion) warnings.push('No OS version specified');
      const config = profile.config as Record<string, unknown>;
      if (!config['appium:automationName']) missing.push('appium:automationName capability');
    }

    if (profile.platform === 'ANDROID') {
      const config = profile.config as Record<string, unknown>;
      if (!config['appium:automationName']) missing.push('appium:automationName capability');
    }

    return {
      capable: missing.length === 0,
      missing,
      warnings,
    };
  }
}

export const devicesService = new DevicesService();
export default devicesService;
