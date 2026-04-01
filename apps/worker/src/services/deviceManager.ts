// VisionTest AI - Device Manager Service
// Manages iOS Simulators and Android Emulators

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

// =============================================================================
// TYPES
// =============================================================================

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  state: 'booted' | 'shutdown' | 'available' | 'unavailable';
  osVersion?: string;
  isEmulator: boolean;
  runtime?: string;
}

export interface DeviceHealthCheck {
  id: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  healthy: boolean;
  state: string;
  message?: string;
}

// =============================================================================
// DEVICE MANAGER
// =============================================================================

export class DeviceManager {
  /**
   * List all available iOS simulators
   */
  async listIOSSimulators(): Promise<DeviceInfo[]> {
    try {
      const { stdout } = await execAsync('xcrun simctl list devices -j');
      const data = JSON.parse(stdout);
      const devices: DeviceInfo[] = [];

      for (const [runtime, runtimeDevices] of Object.entries(data.devices || {})) {
        const osVersion = runtime.replace(/^com\.apple\.CoreSimulator\.SimRuntime\./, '')
          .replace(/-/g, '.')
          .replace('iOS.', 'iOS ');

        for (const device of runtimeDevices as any[]) {
          devices.push({
            id: device.udid,
            name: device.name,
            platform: 'IOS',
            state: device.state?.toLowerCase() === 'booted' ? 'booted' : 
                   device.isAvailable ? 'available' : 'unavailable',
            osVersion,
            isEmulator: true,
            runtime,
          });
        }
      }

      return devices.filter(d => d.state !== 'unavailable');
    } catch (error) {
      logger.warn('Failed to list iOS simulators (xcrun not available):', error);
      return [];
    }
  }

  /**
   * List all available Android emulators (AVDs)
   */
  async listAndroidEmulators(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = [];

    // List available AVDs
    try {
      const { stdout: avdList } = await execAsync('emulator -list-avds 2>/dev/null');
      const avds = avdList.trim().split('\n').filter(Boolean);

      for (const avd of avds) {
        devices.push({
          id: avd,
          name: avd,
          platform: 'ANDROID',
          state: 'available',
          isEmulator: true,
        });
      }
    } catch {
      logger.debug('Android emulator command not available');
    }

    // List running emulators via ADB
    try {
      const { stdout: adbDevices } = await execAsync('adb devices -l 2>/dev/null');
      const lines = adbDevices.trim().split('\n').slice(1); // Skip header

      for (const line of lines) {
        const match = line.match(/^(emulator-\d+|[\w:.]+)\s+(device|offline)\s*(.*)/);
        if (match) {
          const [, id, state, details] = match;
          const modelMatch = details.match(/model:(\S+)/);
          const isRunningEmulator = id.startsWith('emulator-');

          // Check if this is already in our AVD list (running)
          const existingIdx = devices.findIndex(d => 
            isRunningEmulator && d.state === 'available'
          );

          if (existingIdx >= 0 && isRunningEmulator) {
            devices[existingIdx].state = 'booted';
            devices[existingIdx].id = id;
          } else {
            devices.push({
              id,
              name: modelMatch?.[1] || id,
              platform: 'ANDROID',
              state: state === 'device' ? 'booted' : 'shutdown',
              isEmulator: isRunningEmulator,
            });
          }
        }
      }
    } catch {
      logger.debug('ADB not available');
    }

    return devices;
  }

  /**
   * List all available devices across platforms
   */
  async listAllDevices(): Promise<DeviceInfo[]> {
    const [ios, android] = await Promise.all([
      this.listIOSSimulators(),
      this.listAndroidEmulators(),
    ]);

    return [...ios, ...android];
  }

  /**
   * Start an iOS simulator
   */
  async startIOSSimulator(udid: string): Promise<void> {
    try {
      await execAsync(`xcrun simctl boot ${udid}`);
      logger.info(`iOS simulator started: ${udid}`);

      // Open Simulator app to show the device
      await execAsync('open -a Simulator').catch(() => {});
    } catch (error: any) {
      if (error?.stderr?.includes('Unable to boot device in current state: Booted')) {
        logger.info('Simulator already booted');
        return;
      }
      throw new Error(`Failed to start iOS simulator: ${error.message}`);
    }
  }

  /**
   * Stop an iOS simulator
   */
  async stopIOSSimulator(udid: string): Promise<void> {
    try {
      await execAsync(`xcrun simctl shutdown ${udid}`);
      logger.info(`iOS simulator stopped: ${udid}`);
    } catch (error: any) {
      if (error?.stderr?.includes('Unable to shutdown device in current state: Shutdown')) {
        logger.info('Simulator already shutdown');
        return;
      }
      throw new Error(`Failed to stop iOS simulator: ${error.message}`);
    }
  }

  /**
   * Start an Android emulator
   */
  async startAndroidEmulator(avdName: string): Promise<void> {
    try {
      // Start emulator in background with no-window option for headless
      const headless = process.env.ANDROID_HEADLESS !== 'false';
      const args = headless ? '-no-window -no-audio -no-boot-anim' : '';

      exec(`emulator -avd ${avdName} ${args} &`);
      logger.info(`Android emulator starting: ${avdName}`);

      // Wait for the emulator to boot
      await this.waitForAndroidBoot(30000);
    } catch (error: any) {
      throw new Error(`Failed to start Android emulator: ${error.message}`);
    }
  }

  /**
   * Stop an Android emulator
   */
  async stopAndroidEmulator(deviceId: string): Promise<void> {
    try {
      await execAsync(`adb -s ${deviceId} emu kill 2>/dev/null`);
      logger.info(`Android emulator stopped: ${deviceId}`);
    } catch (error: any) {
      throw new Error(`Failed to stop Android emulator: ${error.message}`);
    }
  }

  /**
   * Take a screenshot via platform tools (fallback when Appium is not available)
   */
  async takeScreenshot(deviceId: string, platform: 'IOS' | 'ANDROID'): Promise<Buffer> {
    if (platform === 'IOS') {
      return this.takeIOSScreenshot(deviceId);
    } else {
      return this.takeAndroidScreenshot(deviceId);
    }
  }

  /**
   * Take iOS simulator screenshot via simctl
   */
  private async takeIOSScreenshot(udid: string): Promise<Buffer> {
    const tmpFile = `/tmp/visiontest-ios-${Date.now()}.png`;
    try {
      await execAsync(`xcrun simctl io ${udid} screenshot ${tmpFile}`);
      const { readFile, unlink } = await import('fs/promises');
      const buffer = await readFile(tmpFile);
      await unlink(tmpFile).catch(() => {});
      return buffer;
    } catch (error: any) {
      throw new Error(`Failed to take iOS screenshot: ${error.message}`);
    }
  }

  /**
   * Take Android screenshot via ADB
   */
  private async takeAndroidScreenshot(deviceId: string): Promise<Buffer> {
    const tmpFile = `/tmp/visiontest-android-${Date.now()}.png`;
    try {
      await execAsync(`adb -s ${deviceId} exec-out screencap -p > ${tmpFile}`);
      const { readFile, unlink } = await import('fs/promises');
      const buffer = await readFile(tmpFile);
      await unlink(tmpFile).catch(() => {});
      return buffer;
    } catch (error: any) {
      throw new Error(`Failed to take Android screenshot: ${error.message}`);
    }
  }

  /**
   * Health check for a specific device
   */
  async healthCheck(deviceId: string, platform: 'IOS' | 'ANDROID'): Promise<DeviceHealthCheck> {
    if (platform === 'IOS') {
      return this.healthCheckIOS(deviceId);
    } else {
      return this.healthCheckAndroid(deviceId);
    }
  }

  private async healthCheckIOS(udid: string): Promise<DeviceHealthCheck> {
    try {
      const { stdout } = await execAsync(`xcrun simctl list devices -j`);
      const data = JSON.parse(stdout);

      for (const runtimeDevices of Object.values(data.devices || {})) {
        for (const device of runtimeDevices as any[]) {
          if (device.udid === udid) {
            return {
              id: udid,
              name: device.name,
              platform: 'IOS',
              healthy: device.state === 'Booted',
              state: device.state,
              message: device.state === 'Booted' ? 'Simulator is running' : 'Simulator is not running',
            };
          }
        }
      }

      return {
        id: udid,
        name: 'Unknown',
        platform: 'IOS',
        healthy: false,
        state: 'not_found',
        message: 'Simulator not found',
      };
    } catch {
      return {
        id: udid,
        name: 'Unknown',
        platform: 'IOS',
        healthy: false,
        state: 'error',
        message: 'Unable to check simulator health',
      };
    }
  }

  private async healthCheckAndroid(deviceId: string): Promise<DeviceHealthCheck> {
    try {
      const { stdout } = await execAsync(`adb -s ${deviceId} get-state 2>/dev/null`);
      const state = stdout.trim();

      return {
        id: deviceId,
        name: deviceId,
        platform: 'ANDROID',
        healthy: state === 'device',
        state,
        message: state === 'device' ? 'Device is connected' : `Device state: ${state}`,
      };
    } catch {
      return {
        id: deviceId,
        name: deviceId,
        platform: 'ANDROID',
        healthy: false,
        state: 'disconnected',
        message: 'Device not connected or ADB not available',
      };
    }
  }

  /**
   * Wait for Android emulator to finish booting
   */
  private async waitForAndroidBoot(timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await execAsync('adb shell getprop sys.boot_completed 2>/dev/null');
        if (stdout.trim() === '1') {
          logger.info('Android emulator boot complete');
          return;
        }
      } catch {
        // Not booted yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.warn('Android emulator boot timeout, continuing anyway');
  }
}
