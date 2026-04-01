// VisionTest.ai - Mobile Test Runner Service
// Appium WebDriver integration for native iOS/Android testing

import { logger } from '../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface MobileTestStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  name?: string;
  timeout?: number;
  options?: Record<string, unknown>;
  // Mobile-specific
  coordinates?: { x: number; y: number };
  endCoordinates?: { x: number; y: number };
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  orientation?: 'portrait' | 'landscape';
  bundleId?: string;
  deepLink?: string;
}

export interface MobileTestResult {
  testId?: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: MobileStepResult[];
  error?: string;
  appVersion?: string;
}

export interface MobileStepResult {
  index: number;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface MobileRunConfig {
  executionId: string;
  platform: 'IOS' | 'ANDROID';
  deviceProfile?: {
    name: string;
    width: number;
    height: number;
    scaleFactor: number;
    osVersion?: string;
    isEmulator: boolean;
    config: Record<string, unknown>;
  };
  appiumUrl?: string;
  appPath?: string;
  bundleId?: string;
  appPackage?: string;
  appActivity?: string;
  onProgress?: (progress: { stepIndex: number; total: number }) => Promise<void>;
  onStepComplete?: (stepIndex: number, duration: number) => Promise<void>;
  onStepFailed?: (stepIndex: number, error: string) => Promise<void>;
  onScreenshot?: (stepNumber: number, screenshot: Buffer) => Promise<void>;
}

export interface AppiumCapabilities {
  platformName: string;
  'appium:automationName': string;
  'appium:deviceName': string;
  'appium:platformVersion'?: string;
  'appium:app'?: string;
  'appium:bundleId'?: string;
  'appium:appPackage'?: string;
  'appium:appActivity'?: string;
  'appium:udid'?: string;
  'appium:noReset'?: boolean;
  'appium:fullReset'?: boolean;
  [key: string]: unknown;
}

// =============================================================================
// APPIUM DRIVER
// =============================================================================

/**
 * AppiumDriver wraps the WebDriver protocol for Appium interactions.
 * Uses raw HTTP calls to the Appium server's W3C WebDriver endpoints.
 */
export class AppiumDriver {
  private serverUrl: string;
  private sessionId: string | null = null;
  private platform: 'IOS' | 'ANDROID';

  constructor(serverUrl: string, platform: 'IOS' | 'ANDROID') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.platform = platform;
  }

  /**
   * Create a new Appium session with the specified capabilities
   */
  async createSession(capabilities: AppiumCapabilities): Promise<string> {
    logger.info('Creating Appium session', { capabilities: { ...capabilities, 'appium:app': '[redacted]' } });

    const response = await fetch(`${this.serverUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: capabilities,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to create Appium session: ${response.status} - ${body}`);
    }

    const data = await response.json();
    this.sessionId = data.value?.sessionId || data.sessionId;

    if (!this.sessionId) {
      throw new Error('No session ID returned from Appium server');
    }

    logger.info(`Appium session created: ${this.sessionId}`);
    return this.sessionId;
  }

  /**
   * Delete/quit the current session
   */
  async deleteSession(): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.serverUrl}/session/${this.sessionId}`, {
        method: 'DELETE',
      });
      logger.info(`Appium session deleted: ${this.sessionId}`);
    } catch (error) {
      logger.warn('Failed to delete Appium session:', error);
    } finally {
      this.sessionId = null;
    }
  }

  /**
   * Find an element using various strategies
   */
  async findElement(using: string, value: string): Promise<string> {
    this.ensureSession();

    const response = await this.command('POST', '/element', {
      using,
      value,
    });

    const elementId = response.ELEMENT || response['element-6066-11e4-a52e-4f735466cecf'] || Object.values(response)[0];
    if (!elementId) {
      throw new Error(`Element not found: ${using}=${value}`);
    }

    return elementId;
  }

  /**
   * Find element by accessibility ID (cross-platform)
   */
  async findByAccessibilityId(id: string): Promise<string> {
    return this.findElement('accessibility id', id);
  }

  /**
   * Find element by XPath
   */
  async findByXPath(xpath: string): Promise<string> {
    return this.findElement('xpath', xpath);
  }

  /**
   * Find element by class name
   */
  async findByClassName(className: string): Promise<string> {
    return this.findElement('class name', className);
  }

  /**
   * Find element by iOS predicate string
   */
  async findByiOSPredicate(predicate: string): Promise<string> {
    return this.findElement('-ios predicate string', predicate);
  }

  /**
   * Find element by Android UIAutomator
   */
  async findByAndroidUIAutomator(selector: string): Promise<string> {
    return this.findElement('-android uiautomator', selector);
  }

  /**
   * Tap on an element
   */
  async tap(elementId: string): Promise<void> {
    this.ensureSession();
    await this.command('POST', `/element/${elementId}/click`);
  }

  /**
   * Tap at specific coordinates
   */
  async tapAt(x: number, y: number): Promise<void> {
    this.ensureSession();

    await this.command('POST', '/actions', {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    });
  }

  /**
   * Double tap on an element
   */
  async doubleTap(elementId: string): Promise<void> {
    this.ensureSession();

    // Get element location for touch actions
    const location = await this.getElementLocation(elementId);
    const size = await this.getElementSize(elementId);
    const x = location.x + size.width / 2;
    const y = location.y + size.height / 2;

    await this.command('POST', '/actions', {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 50 },
          { type: 'pointerUp', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 50 },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    });
  }

  /**
   * Long press on an element
   */
  async longPress(elementId: string, duration: number = 2000): Promise<void> {
    this.ensureSession();

    const location = await this.getElementLocation(elementId);
    const size = await this.getElementSize(elementId);
    const x = location.x + size.width / 2;
    const y = location.y + size.height / 2;

    await this.command('POST', '/actions', {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    });
  }

  /**
   * Type text into the focused element or a specific element
   */
  async type(elementId: string, text: string): Promise<void> {
    this.ensureSession();
    await this.command('POST', `/element/${elementId}/value`, {
      text,
      value: text.split(''),
    });
  }

  /**
   * Clear text from an element
   */
  async clear(elementId: string): Promise<void> {
    this.ensureSession();
    await this.command('POST', `/element/${elementId}/clear`);
  }

  /**
   * Get element text
   */
  async getText(elementId: string): Promise<string> {
    this.ensureSession();
    return this.command('GET', `/element/${elementId}/text`);
  }

  /**
   * Get element attribute
   */
  async getAttribute(elementId: string, name: string): Promise<string> {
    this.ensureSession();
    return this.command('GET', `/element/${elementId}/attribute/${name}`);
  }

  /**
   * Check if element is displayed
   */
  async isDisplayed(elementId: string): Promise<boolean> {
    this.ensureSession();
    return this.command('GET', `/element/${elementId}/displayed`);
  }

  /**
   * Swipe in a direction
   */
  async swipe(
    startX: number, startY: number,
    endX: number, endY: number,
    duration: number = 500
  ): Promise<void> {
    this.ensureSession();

    await this.command('POST', '/actions', {
      actions: [{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pointerMove', duration, x: endX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      }],
    });
  }

  /**
   * Swipe in a named direction (convenience method)
   */
  async swipeDirection(direction: 'up' | 'down' | 'left' | 'right', percent: number = 0.5): Promise<void> {
    const windowSize = await this.getWindowSize();
    const cx = windowSize.width / 2;
    const cy = windowSize.height / 2;
    const dx = windowSize.width * percent;
    const dy = windowSize.height * percent;

    switch (direction) {
      case 'up':
        await this.swipe(cx, cy + dy / 2, cx, cy - dy / 2);
        break;
      case 'down':
        await this.swipe(cx, cy - dy / 2, cx, cy + dy / 2);
        break;
      case 'left':
        await this.swipe(cx + dx / 2, cy, cx - dx / 2, cy);
        break;
      case 'right':
        await this.swipe(cx - dx / 2, cy, cx + dx / 2, cy);
        break;
    }
  }

  /**
   * Scroll in a direction
   */
  async scroll(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    // Scroll is similar to swipe but with smaller distance and slower
    await this.swipeDirection(direction, 0.3);
  }

  /**
   * Pinch gesture (zoom in/out)
   */
  async pinch(scale: number, x?: number, y?: number): Promise<void> {
    this.ensureSession();

    const windowSize = await this.getWindowSize();
    const centerX = x ?? windowSize.width / 2;
    const centerY = y ?? windowSize.height / 2;
    const distance = 100;

    if (scale > 1) {
      // Pinch out (zoom in) - fingers move apart
      await this.command('POST', '/actions', {
        actions: [
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX, y: centerY },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 500, x: centerX - distance, y: centerY - distance },
              { type: 'pointerUp', button: 0 },
            ],
          },
          {
            type: 'pointer',
            id: 'finger2',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX, y: centerY },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 500, x: centerX + distance, y: centerY + distance },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      });
    } else {
      // Pinch in (zoom out) - fingers move together
      await this.command('POST', '/actions', {
        actions: [
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX - distance, y: centerY - distance },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 500, x: centerX, y: centerY },
              { type: 'pointerUp', button: 0 },
            ],
          },
          {
            type: 'pointer',
            id: 'finger2',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: centerX + distance, y: centerY + distance },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 500, x: centerX, y: centerY },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      });
    }
  }

  /**
   * Take a screenshot and return as Buffer
   */
  async takeScreenshot(): Promise<Buffer> {
    this.ensureSession();

    const base64 = await this.command('GET', '/screenshot');
    return Buffer.from(base64, 'base64');
  }

  /**
   * Get the window/viewport size
   */
  async getWindowSize(): Promise<{ width: number; height: number }> {
    this.ensureSession();
    return this.command('GET', '/window/rect');
  }

  /**
   * Launch or activate an app
   */
  async launchApp(bundleId?: string): Promise<void> {
    this.ensureSession();

    if (this.platform === 'IOS') {
      await this.command('POST', '/appium/device/activate_app', {
        bundleId: bundleId || '',
      });
    } else {
      await this.command('POST', '/appium/device/activate_app', {
        appId: bundleId || '',
      });
    }
  }

  /**
   * Close/terminate an app
   */
  async closeApp(bundleId?: string): Promise<void> {
    this.ensureSession();

    await this.command('POST', '/appium/device/terminate_app', {
      bundleId: bundleId || '',
    });
  }

  /**
   * Reset the app (clear data and restart)
   */
  async resetApp(): Promise<void> {
    this.ensureSession();
    await this.command('POST', '/appium/app/reset');
  }

  /**
   * Navigate to a deep link URL
   */
  async openDeepLink(url: string): Promise<void> {
    this.ensureSession();

    if (this.platform === 'IOS') {
      await this.command('POST', '/url', { url });
    } else {
      // Android: use adb shell am start
      await this.command('POST', '/appium/device/shell', {
        command: 'am',
        args: ['start', '-a', 'android.intent.action.VIEW', '-d', url],
      });
    }
  }

  /**
   * Set device orientation
   */
  async setOrientation(orientation: 'PORTRAIT' | 'LANDSCAPE'): Promise<void> {
    this.ensureSession();
    await this.command('POST', '/orientation', { orientation });
  }

  /**
   * Get device orientation
   */
  async getOrientation(): Promise<string> {
    this.ensureSession();
    return this.command('GET', '/orientation');
  }

  /**
   * Hide the keyboard
   */
  async hideKeyboard(): Promise<void> {
    this.ensureSession();

    try {
      if (this.platform === 'IOS') {
        await this.command('POST', '/appium/device/hide_keyboard', {
          strategy: 'tapOutside',
        });
      } else {
        await this.command('POST', '/appium/device/hide_keyboard');
      }
    } catch {
      logger.debug('Keyboard may not be visible');
    }
  }

  /**
   * Press device back button (Android)
   */
  async pressBack(): Promise<void> {
    this.ensureSession();

    if (this.platform === 'ANDROID') {
      await this.command('POST', '/appium/device/press_button', {
        name: 'back',
      });
    }
  }

  /**
   * Press home button
   */
  async pressHome(): Promise<void> {
    this.ensureSession();

    await this.command('POST', '/appium/device/press_button', {
      name: 'home',
    });
  }

  /**
   * Shake the device (iOS simulator)
   */
  async shake(): Promise<void> {
    this.ensureSession();
    await this.command('POST', '/appium/device/shake');
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(using: string, value: string, timeout: number = 10000): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        return await this.findElement(using, value);
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    throw new Error(`Element not found after ${timeout}ms: ${using}=${value}`);
  }

  /**
   * Get element location
   */
  private async getElementLocation(elementId: string): Promise<{ x: number; y: number }> {
    return this.command('GET', `/element/${elementId}/location`);
  }

  /**
   * Get element size
   */
  private async getElementSize(elementId: string): Promise<{ width: number; height: number }> {
    return this.command('GET', `/element/${elementId}/size`);
  }

  /**
   * Send a command to the Appium server
   */
  private async command(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.serverUrl}/session/${this.sessionId}${path}`;

    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Appium command failed: ${method} ${path} - ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data.value;
  }

  private ensureSession(): void {
    if (!this.sessionId) {
      throw new Error('No active Appium session. Call createSession() first.');
    }
  }
}

// =============================================================================
// MOBILE TEST RUNNER
// =============================================================================

export class MobileTestRunner {
  private driver: AppiumDriver | null = null;
  private isClosing: boolean = false;

  /**
   * Run mobile tests against native iOS/Android apps
   */
  async runTests(tests: any[], config: MobileRunConfig): Promise<MobileTestResult[]> {
    const results: MobileTestResult[] = [];
    this.isClosing = false;

    const appiumUrl = config.appiumUrl || process.env.APPIUM_URL || 'http://localhost:4723';
    this.driver = new AppiumDriver(appiumUrl, config.platform);

    try {
      // Build capabilities from device profile
      const capabilities = this.buildCapabilities(config);

      // Create Appium session
      await this.driver.createSession(capabilities);

      for (const test of tests) {
        if (this.isClosing) break;

        const result = await this.runTest(test, config);
        results.push(result);
      }

      return results;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Stop the test runner
   */
  async stop(): Promise<void> {
    this.isClosing = true;
    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    this.isClosing = true;

    if (this.driver) {
      try {
        await this.driver.deleteSession();
      } catch (error) {
        logger.debug('Session already closed during cleanup');
      }
      this.driver = null;
    }
  }

  private buildCapabilities(config: MobileRunConfig): AppiumCapabilities {
    const profile = config.deviceProfile;
    const caps: AppiumCapabilities = {
      platformName: config.platform === 'IOS' ? 'iOS' : 'Android',
      'appium:automationName': config.platform === 'IOS' ? 'XCUITest' : 'UiAutomator2',
      'appium:deviceName': profile?.name || (config.platform === 'IOS' ? 'iPhone Simulator' : 'Android Emulator'),
      'appium:noReset': true,
    };

    if (profile?.osVersion) {
      caps['appium:platformVersion'] = profile.osVersion;
    }

    if (config.appPath) {
      caps['appium:app'] = config.appPath;
    }

    if (config.bundleId) {
      caps['appium:bundleId'] = config.bundleId;
    }

    if (config.appPackage) {
      caps['appium:appPackage'] = config.appPackage;
    }

    if (config.appActivity) {
      caps['appium:appActivity'] = config.appActivity;
    }

    // Merge any custom capabilities from the device profile
    if (profile?.config) {
      Object.assign(caps, profile.config);
    }

    return caps;
  }

  private async runTest(test: any, config: MobileRunConfig): Promise<MobileTestResult> {
    const startTime = Date.now();
    const steps: MobileStepResult[] = [];

    try {
      const testSteps: MobileTestStep[] = typeof test.steps === 'string'
        ? JSON.parse(test.steps)
        : test.steps;

      for (let stepIndex = 0; stepIndex < testSteps.length; stepIndex++) {
        if (this.isClosing) break;

        const step = testSteps[stepIndex];
        const stepStart = Date.now();

        try {
          if (config.onProgress) {
            await config.onProgress({ stepIndex, total: testSteps.length });
          }

          await this.executeStep(step, config);

          const stepDuration = Date.now() - stepStart;
          steps.push({
            index: stepIndex,
            type: step.type,
            status: 'passed',
            duration: stepDuration,
          });

          if (config.onStepComplete) {
            await config.onStepComplete(stepIndex, stepDuration);
          }
        } catch (error) {
          // Take failure screenshot
          if (config.onScreenshot && this.driver) {
            try {
              const screenshot = await this.driver.takeScreenshot();
              await config.onScreenshot(stepIndex, screenshot);
            } catch {
              logger.debug('Failed to take failure screenshot');
            }
          }

          const stepError = error instanceof Error ? error.message : 'Unknown error';
          steps.push({
            index: stepIndex,
            type: step.type,
            status: 'failed',
            duration: Date.now() - stepStart,
            error: stepError,
          });

          if (config.onStepFailed) {
            await config.onStepFailed(stepIndex, stepError);
          }

          throw error;
        }
      }

      return {
        testId: test.id,
        name: test.name,
        status: 'passed',
        duration: Date.now() - startTime,
        steps,
      };
    } catch (error) {
      return {
        testId: test.id,
        name: test.name,
        status: 'failed',
        duration: Date.now() - startTime,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async executeStep(step: MobileTestStep, config: MobileRunConfig): Promise<void> {
    if (!this.driver) throw new Error('No active driver');

    const timeout = step.timeout || 30000;

    switch (step.type) {
      case 'tap': {
        if (step.coordinates) {
          await this.driver.tapAt(step.coordinates.x, step.coordinates.y);
        } else if (step.selector) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          await this.driver.tap(el);
        }
        break;
      }

      case 'doubleTap': {
        if (step.selector) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          await this.driver.doubleTap(el);
        }
        break;
      }

      case 'longPress': {
        if (step.selector) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          await this.driver.longPress(el, step.duration || 2000);
        }
        break;
      }

      case 'typeText': {
        if (step.selector && step.value) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          await this.driver.tap(el);
          await this.driver.type(el, step.value);
        }
        break;
      }

      case 'swipe': {
        if (step.direction) {
          await this.driver.swipeDirection(step.direction);
        } else if (step.coordinates && step.endCoordinates) {
          await this.driver.swipe(
            step.coordinates.x, step.coordinates.y,
            step.endCoordinates.x, step.endCoordinates.y,
            step.duration || 500
          );
        }
        break;
      }

      case 'scroll': {
        const dir = step.direction || 'down';
        await this.driver.scroll(dir);
        break;
      }

      case 'pinch': {
        const scale = step.options?.scale as number ?? 0.5;
        await this.driver.pinch(scale);
        break;
      }

      case 'shake': {
        await this.driver.shake();
        break;
      }

      case 'rotate': {
        const orientation = step.orientation === 'landscape' ? 'LANDSCAPE' : 'PORTRAIT';
        await this.driver.setOrientation(orientation);
        break;
      }

      case 'launchApp': {
        await this.driver.launchApp(step.bundleId || config.bundleId);
        break;
      }

      case 'deepLink': {
        if (step.deepLink || step.url) {
          await this.driver.openDeepLink(step.deepLink || step.url!);
        }
        break;
      }

      case 'backButton': {
        await this.driver.pressBack();
        break;
      }

      case 'homeButton': {
        await this.driver.pressHome();
        break;
      }

      case 'hideKeyboard': {
        await this.driver.hideKeyboard();
        break;
      }

      case 'waitFor': {
        if (step.selector) {
          await this.driver.waitForElement('accessibility id', step.selector, timeout);
        } else if (step.duration) {
          await new Promise(resolve => setTimeout(resolve, step.duration));
        }
        break;
      }

      case 'screenshot': {
        if (config.onScreenshot) {
          const screenshot = await this.driver.takeScreenshot();
          await config.onScreenshot(0, screenshot);
        }
        break;
      }

      case 'assert': {
        if (step.selector) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          const displayed = await this.driver.isDisplayed(el);
          if (!displayed) {
            throw new Error(`Element not displayed: ${step.selector}`);
          }
          if (step.value) {
            const text = await this.driver.getText(el);
            if (text !== step.value) {
              throw new Error(`Expected text "${step.value}" but got "${text}"`);
            }
          }
        }
        break;
      }

      case 'notification': {
        // Open notification shade (Android)
        if (config.platform === 'ANDROID') {
          const windowSize = await this.driver.getWindowSize();
          await this.driver.swipe(
            windowSize.width / 2, 0,
            windowSize.width / 2, windowSize.height / 2,
            300
          );
        }
        break;
      }

      // Legacy web-like steps (for compatibility)
      case 'navigate':
        if (step.url) {
          await this.driver.openDeepLink(step.url);
        }
        break;

      case 'click':
        if (step.selector) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          await this.driver.tap(el);
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          const el = await this.driver.waitForElement('accessibility id', step.selector, timeout);
          await this.driver.clear(el);
          await this.driver.type(el, step.value);
        }
        break;

      default:
        logger.warn(`Unknown mobile step type: ${step.type}`);
    }
  }
}
