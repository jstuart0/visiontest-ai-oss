// VisionTest.ai - Test Runner Service
// Executes tests using Playwright

import { chromium, firefox, webkit, Browser, Page, BrowserContext, CDPSession, devices } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { prisma } from '@visiontest/database';
import { logger } from '../utils/logger';

// =============================================================================
// BUILT-IN MOBILE WEB DEVICE PROFILES
// =============================================================================

export interface MobileWebDevice {
  name: string;
  viewport: { width: number; height: number };
  userAgent: string;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

/**
 * Built-in mobile device profiles for MOBILE_WEB platform testing.
 * Uses Playwright's built-in device descriptors plus custom additions.
 */
export const MOBILE_WEB_DEVICES: Record<string, MobileWebDevice> = {
  'iPhone 15': {
    ...(devices['iPhone 15'] || {
      viewport: { width: 393, height: 852 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    }),
    name: 'iPhone 15',
  },
  'iPhone 15 Pro': {
    name: 'iPhone 15 Pro',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPhone 15 Pro Max': {
    name: 'iPhone 15 Pro Max',
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPhone SE': {
    ...(devices['iPhone SE'] || {
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    }),
    name: 'iPhone SE',
  },
  'iPad': {
    ...(devices['iPad (gen 7)'] || {
      viewport: { width: 810, height: 1080 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    }),
    name: 'iPad',
  },
  'iPad Pro 11': {
    name: 'iPad Pro 11',
    viewport: { width: 834, height: 1194 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'Pixel 8': {
    name: 'Pixel 8',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  'Galaxy S24': {
    name: 'Galaxy S24',
    viewport: { width: 360, height: 780 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'Galaxy Tab S9': {
    name: 'Galaxy Tab S9',
    viewport: { width: 800, height: 1280 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Safari/537.36',
    deviceScaleFactor: 1.5,
    isMobile: true,
    hasTouch: true,
  },
};

export interface TestStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  name?: string;
  assertion?: string;
  timeout?: number;
  options?: Record<string, unknown>;
}

export interface TestResult {
  testId?: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: StepResult[];
  error?: string;
}

export interface StepResult {
  index: number;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
  healed?: boolean;
}

export interface RunConfig {
  executionId: string;
  config?: {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    viewport?: { width: number; height: number };
    baseUrl?: string;
    timeout?: number;
  };
  platform?: 'WEB' | 'MOBILE_WEB';
  deviceProfile?: {
    name: string;
    width: number;
    height: number;
    scaleFactor: number;
    userAgent?: string;
  };
  mobileWebDevice?: string; // Key from MOBILE_WEB_DEVICES
  replayFrom?: {
    checkpointId: string;
    stepNumber: number;
  };
  autoScreenshot?: boolean;
  recordVideo?: boolean;
  videoDir?: string;
  enableLiveStream?: boolean;
  onProgress?: (progress: { testIndex: number; stepIndex: number; total: number }) => Promise<void>;
  onStepComplete?: (stepIndex: number, duration: number) => Promise<void>;
  onStepFailed?: (stepIndex: number, error: string) => Promise<void>;
  onScreenshot?: (stepNumber: number, screenshot: Buffer) => Promise<void>;
  onHealing?: (event: HealingEvent) => Promise<void>;
  onCheckpoint?: (stepNumber: number, state: CheckpointState) => Promise<void>;
  onVideoReady?: (videoPath: string) => Promise<void>;
  onFrame?: (frameData: string) => Promise<void>;
}

export interface HealingEvent {
  stepIndex: number;
  originalSelector: string;
  healedSelector: string;
  strategy: string;
  confidence: number;
}

export interface CheckpointState {
  url: string;
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export class TestRunner {
  private browser: Browser | null = null;
  private activeContexts: Set<BrowserContext> = new Set();
  private isClosing: boolean = false;
  private aiService?: any;

  /**
   * Attach an AIService instance for LLM-powered healing.
   */
  setAIService(service: any): void {
    this.aiService = service;
  }

  async runTests(tests: any[], config: RunConfig): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const browserType = config.config?.browser || 'chromium';
    this.isClosing = false;

    try {
      // Launch browser
      this.browser = await this.launchBrowser(browserType, config.config?.headless ?? true);
      
      for (let testIndex = 0; testIndex < tests.length; testIndex++) {
        // Check if browser was closed prematurely
        if (this.isClosing || !this.browser?.isConnected()) {
          logger.warn('Browser disconnected, stopping test execution');
          break;
        }
        
        const test = tests[testIndex];
        const result = await this.runTest(test, testIndex, config);
        results.push(result);
      }

      return results;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Safely cleanup all browser resources
   */
  private async cleanup(): Promise<void> {
    this.isClosing = true;

    // Close all active contexts first
    const closePromises = Array.from(this.activeContexts).map(async (ctx) => {
      try {
        if (!ctx.browser()?.isConnected()) return;
        await ctx.close();
      } catch (error) {
        // Context may already be closed, ignore
        logger.debug('Context already closed during cleanup');
      }
    });

    await Promise.allSettled(closePromises);
    this.activeContexts.clear();

    // Then close the browser
    if (this.browser) {
      try {
        if (this.browser.isConnected()) {
          await this.browser.close();
        }
      } catch (error) {
        logger.debug('Browser already closed during cleanup');
      }
      this.browser = null;
    }
  }

  private async launchBrowser(type: string, headless: boolean): Promise<Browser> {
    const options = {
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };

    switch (type) {
      case 'firefox':
        return firefox.launch(options);
      case 'webkit':
        return webkit.launch(options);
      default:
        return chromium.launch(options);
    }
  }

  private async runTest(test: any, testIndex: number, config: RunConfig): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let stopScreencast: (() => Promise<void>) | null = null;

    try {
      // Check if browser is still connected
      if (!this.browser?.isConnected() || this.isClosing) {
        throw new Error('Browser is not available');
      }

      // Create context — configure for MOBILE_WEB if needed
      const contextOptions: any = {
        viewport: config.config?.viewport || { width: 1920, height: 1080 },
      };

      if (config.platform === 'MOBILE_WEB') {
        // Use Playwright device emulation for mobile web testing
        const deviceKey = config.mobileWebDevice || config.deviceProfile?.name;
        const device = deviceKey ? MOBILE_WEB_DEVICES[deviceKey] : null;

        if (device) {
          contextOptions.viewport = device.viewport;
          contextOptions.userAgent = device.userAgent;
          contextOptions.deviceScaleFactor = device.deviceScaleFactor;
          contextOptions.isMobile = device.isMobile;
          contextOptions.hasTouch = device.hasTouch;
          logger.info(`Using mobile device emulation: ${device.name}`);
        } else if (config.deviceProfile) {
          contextOptions.viewport = { width: config.deviceProfile.width, height: config.deviceProfile.height };
          contextOptions.deviceScaleFactor = config.deviceProfile.scaleFactor;
          contextOptions.isMobile = true;
          contextOptions.hasTouch = true;
          if (config.deviceProfile.userAgent) {
            contextOptions.userAgent = config.deviceProfile.userAgent;
          }
          logger.info(`Using custom device profile: ${config.deviceProfile.name}`);
        }
      }

      // Video recording support
      if (config.recordVideo) {
        const videoDir = config.videoDir || path.join(os.tmpdir(), 'visiontest-videos', config.executionId);
        if (!fs.existsSync(videoDir)) {
          fs.mkdirSync(videoDir, { recursive: true });
        }
        contextOptions.recordVideo = {
          dir: videoDir,
          size: contextOptions.viewport || { width: 1920, height: 1080 },
        };
      }

      context = await this.browser!.newContext(contextOptions);

      // Track active contexts for proper cleanup
      this.activeContexts.add(context);

      page = await context.newPage();

      // Start CDP screencast for live streaming (Chromium only)
      if (config.enableLiveStream && config.onFrame) {
        stopScreencast = await this.startScreencast(page, config.onFrame);
      }

      // Set base URL if configured
      if (config.config?.baseUrl) {
        await page.goto(config.config.baseUrl);
      }

      // Parse test steps
      const testSteps: TestStep[] = typeof test.steps === 'string' 
        ? JSON.parse(test.steps) 
        : test.steps;

      // Determine starting step (for replay)
      let startStep = 0;
      if (config.replayFrom) {
        startStep = config.replayFrom.stepNumber;
        // Restore checkpoint state from previous execution
        await this.restoreCheckpointState(page, config.replayFrom.checkpointId);
      }

      // Execute steps
      for (let stepIndex = startStep; stepIndex < testSteps.length; stepIndex++) {
        const step = testSteps[stepIndex];
        const stepStart = Date.now();

        try {
          // Report progress
          if (config.onProgress) {
            await config.onProgress({
              testIndex,
              stepIndex,
              total: testSteps.length,
            });
          }

          // Execute step
          await this.executeStep(page, step, config);

          // Save checkpoint
          if (config.onCheckpoint) {
            const state = await this.captureState(page);
            await config.onCheckpoint(stepIndex, state);
          }

          const stepDuration = Date.now() - stepStart;
          steps.push({
            index: stepIndex,
            type: step.type,
            status: 'passed',
            duration: stepDuration,
          });

          // Report step completion
          if (config.onStepComplete) {
            await config.onStepComplete(stepIndex, stepDuration);
          }

          // Auto-screenshot after each step (skip if step was already a screenshot)
          if (config.autoScreenshot && config.onScreenshot && step.type !== 'screenshot') {
            try {
              const autoScreenshot = await page.screenshot();
              await config.onScreenshot(stepIndex, autoScreenshot);
            } catch (screenshotError) {
              logger.warn(`Auto-screenshot failed for step ${stepIndex}:`, screenshotError);
            }
          }
        } catch (error) {
          // Try self-healing
          let healed = false;
          if (step.selector && config.onHealing) {
            const healedSelector = await this.tryHeal(page, step, config);
            if (healedSelector) {
              healed = true;
              const stepDuration = Date.now() - stepStart;
              steps.push({
                index: stepIndex,
                type: step.type,
                status: 'passed',
                duration: stepDuration,
                healed: true,
              });

              // Report step completion (healed)
              if (config.onStepComplete) {
                await config.onStepComplete(stepIndex, stepDuration);
              }
              continue;
            }
          }

          // Take failure screenshot
          if (config.onScreenshot) {
            const screenshot = await page.screenshot();
            await config.onScreenshot(stepIndex, screenshot);
          }

          const stepError = error instanceof Error ? error.message : 'Unknown error';
          steps.push({
            index: stepIndex,
            type: step.type,
            status: 'failed',
            duration: Date.now() - stepStart,
            error: stepError,
          });

          // Report step failure
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
    } finally {
      // Stop screencast before closing context
      if (stopScreencast) {
        try {
          await stopScreencast();
        } catch {
          logger.debug('Screencast already stopped');
        }
      }

      // Get video path before closing context (video is finalized on close)
      let videoPath: string | undefined;
      if (config.recordVideo && page) {
        try {
          videoPath = await page.video()?.path();
        } catch {
          logger.debug('Could not get video path');
        }
      }

      if (context) {
        this.activeContexts.delete(context);
        try {
          // Only close if browser is still connected and we're not already closing
          if (!this.isClosing && this.browser?.isConnected()) {
            await context.close();
          }
        } catch (error) {
          // Context may already be closed, ignore
          logger.debug('Context already closed in test cleanup');
        }
      }

      // Process video after context close (video file is finalized)
      if (videoPath && config.onVideoReady) {
        try {
          await config.onVideoReady(videoPath);
        } catch (error) {
          logger.error('Failed to process video:', error);
        }
      }
    }
  }

  /**
   * Restore browser state from a checkpoint
   */
  private async restoreCheckpointState(page: Page, checkpointId: string): Promise<void> {
    try {
      const checkpoint = await prisma.checkpoint.findUnique({
        where: { id: checkpointId },
      });

      if (!checkpoint || !checkpoint.state) {
        logger.warn(`Checkpoint not found: ${checkpointId}`);
        return;
      }

      const state = checkpoint.state as unknown as CheckpointState;

      // Navigate to the saved URL
      if (state.url) {
        await page.goto(state.url);
      }

      // Restore cookies
      if (state.cookies && state.cookies.length > 0) {
        await page.context().addCookies(state.cookies);
      }

      // Restore localStorage
      if (state.localStorage && Object.keys(state.localStorage).length > 0) {
        await page.evaluate((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            localStorage.setItem(key, value);
          }
        }, state.localStorage);
      }

      // Restore sessionStorage
      if (state.sessionStorage && Object.keys(state.sessionStorage).length > 0) {
        await page.evaluate((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            sessionStorage.setItem(key, value);
          }
        }, state.sessionStorage);
      }

      // Reload to apply storage changes
      await page.reload();

      logger.info(`Checkpoint state restored: ${checkpointId}`);
    } catch (error) {
      logger.error('Failed to restore checkpoint state:', error);
      throw error;
    }
  }

  /**
   * Start CDP screencast for live browser streaming (Chromium only)
   */
  private async startScreencast(
    page: Page,
    onFrame: (frameData: string) => Promise<void>
  ): Promise<() => Promise<void>> {
    let cdpSession: CDPSession | null = null;

    try {
      cdpSession = await page.context().newCDPSession(page);

      cdpSession.on('Page.screencastFrame', async (params: any) => {
        try {
          // ACK the frame to keep receiving
          await cdpSession!.send('Page.screencastFrameAck', {
            sessionId: params.sessionId,
          });
          // Forward base64 JPEG to callback
          await onFrame(params.data);
        } catch {
          // Ignore frame errors during execution
        }
      });

      await cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 50,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 2,
      });

      logger.info('CDP screencast started');
    } catch (error) {
      // CDP not available (Firefox/WebKit) - gracefully skip
      logger.debug('CDP screencast not available (non-Chromium browser)');
      return async () => {};
    }

    return async () => {
      if (cdpSession) {
        try {
          await cdpSession.send('Page.stopScreencast');
          await cdpSession.detach();
        } catch {
          // Session may already be closed
        }
      }
    };
  }

  private async executeStep(page: Page, step: TestStep, config: RunConfig): Promise<void> {
    const timeout = step.timeout || config.config?.timeout || 30000;

    switch (step.type) {
      case 'navigate':
        await page.goto(step.url!, { timeout });
        break;

      case 'click':
        await page.click(step.selector!, { timeout });
        break;

      case 'type':
        await page.fill(step.selector!, step.value || '', { timeout });
        break;

      case 'clear':
        await page.fill(step.selector!, '', { timeout });
        break;

      case 'select':
        await page.selectOption(step.selector!, step.value!, { timeout });
        break;

      case 'hover':
        await page.hover(step.selector!, { timeout });
        break;

      case 'scroll':
        if (step.selector) {
          await page.locator(step.selector).scrollIntoViewIfNeeded({ timeout });
        } else {
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        }
        break;

      case 'waitFor':
        await page.waitForSelector(step.selector!, { timeout });
        break;

      case 'assert':
        await this.executeAssertion(page, step, timeout);
        break;

      case 'screenshot':
        if (config.onScreenshot) {
          const options: any = {};
          if (step.options?.fullPage) {
            options.fullPage = true;
          }
          const screenshot = await page.screenshot(options);
          await config.onScreenshot(0, screenshot);
        }
        break;

      case 'ai':
        // AI step - interpret natural language instruction
        await this.executeAIStep(page, step, config);
        break;

      default:
        logger.warn(`Unknown step type: ${step.type}`);
    }
  }

  private async executeAssertion(page: Page, step: TestStep, timeout: number): Promise<void> {
    const locator = page.locator(step.selector!);

    switch (step.assertion) {
      case 'visible':
        await expect(locator).toBeVisible({ timeout });
        break;

      case 'hidden':
        await expect(locator).toBeHidden({ timeout });
        break;

      case 'text':
        await expect(locator).toHaveText(step.value!, { timeout });
        break;

      case 'value':
        await expect(locator).toHaveValue(step.value!, { timeout });
        break;

      case 'count':
        await expect(locator).toHaveCount(parseInt(step.value!), { timeout });
        break;

      case 'enabled':
        await expect(locator).toBeEnabled({ timeout });
        break;

      case 'disabled':
        await expect(locator).toBeDisabled({ timeout });
        break;

      default:
        // Default: check element exists
        await locator.waitFor({ state: 'visible', timeout });
    }
  }

  private async captureState(page: Page): Promise<CheckpointState> {
    const cookies = await page.context().cookies();
    
    const storage = await page.evaluate(() => ({
      localStorage: Object.fromEntries(Object.entries(localStorage)),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
    }));

    return {
      url: page.url(),
      cookies,
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
    };
  }

  private async tryHeal(page: Page, step: TestStep, config: RunConfig): Promise<string | null> {
    // Check heal cache first
    const cached = await prisma.healingPattern.findFirst({
      where: { originalSelector: step.selector! },
      orderBy: { successCount: 'desc' },
    });

    if (cached) {
      try {
        await page.waitForSelector(cached.healedSelector, { timeout: 5000 });
        
        // Update success count
        await prisma.healingPattern.update({
          where: { id: cached.id },
          data: { 
            successCount: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });

        if (config.onHealing) {
          await config.onHealing({
            stepIndex: 0,
            originalSelector: step.selector!,
            healedSelector: cached.healedSelector,
            strategy: 'CACHE',
            confidence: cached.confidence,
          });
        }

        return cached.healedSelector;
      } catch {
        // Cached selector also failed
      }
    }

    // Try alternative selectors
    const alternatives = this.generateAlternativeSelectors(step.selector!);
    
    for (const alt of alternatives) {
      try {
        await page.waitForSelector(alt, { timeout: 2000 });
        
        // Found working alternative
        await prisma.healingPattern.create({
          data: {
            originalSelector: step.selector!,
            healedSelector: alt,
            strategy: 'DOM_ANALYSIS',
            confidence: 0.8,
          },
        });

        if (config.onHealing) {
          await config.onHealing({
            stepIndex: 0,
            originalSelector: step.selector!,
            healedSelector: alt,
            strategy: 'DOM_ANALYSIS',
            confidence: 0.8,
          });
        }

        return alt;
      } catch {
        // Try next alternative
      }
    }

    // Try AI-powered healing (DOM heuristic analysis)
    let healed: string | null = null;
    const aiHealedSelector = await this.tryAIHealing(page, step);
    if (aiHealedSelector) {
      try {
        await page.waitForSelector(aiHealedSelector, { timeout: 3000 });

        // Store successful AI healing pattern
        await prisma.healingPattern.create({
          data: {
            originalSelector: step.selector!,
            healedSelector: aiHealedSelector,
            strategy: 'AI_INFERENCE',
            confidence: 0.7,
          },
        });

        if (config.onHealing) {
          await config.onHealing({
            stepIndex: 0,
            originalSelector: step.selector!,
            healedSelector: aiHealedSelector,
            strategy: 'AI_INFERENCE',
            confidence: 0.7,
          });
        }

        healed = aiHealedSelector;
      } catch {
        // AI suggestion also failed
      }
    }

    // Strategy 4: LLM_INFERENCE — real LLM call with page context
    if (!healed && this.aiService?.isAvailable()) {
      const llmHealed = await this.tryLLMHealing(page, step.selector!, page.url());
      if (llmHealed) {
        if (config.onHealing) {
          await config.onHealing({
            stepIndex: 0,
            originalSelector: step.selector!,
            healedSelector: llmHealed,
            strategy: 'LLM_INFERENCE',
            confidence: 0.75,
          });
        }
        healed = llmHealed;
      }
    }

    return healed;
  }

  /**
   * Execute AI-interpreted step using natural language
   */
  private async executeAIStep(page: Page, step: TestStep, config: RunConfig): Promise<void> {
    const instruction = step.value || step.name || '';
    if (!instruction) {
      logger.warn('AI step has no instruction');
      return;
    }

    logger.info(`Executing AI step: "${instruction}"`);

    // Analyze the page content to understand context
    const pageContent = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      buttons: Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).map(el => ({
        text: el.textContent?.trim() || '',
        id: el.id,
        className: el.className,
        type: el.getAttribute('type'),
      })),
      links: Array.from(document.querySelectorAll('a')).map(el => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href'),
        id: el.id,
      })),
      inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
        type: el.getAttribute('type') || el.tagName.toLowerCase(),
        name: el.getAttribute('name'),
        id: el.id,
        placeholder: el.getAttribute('placeholder'),
        label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim(),
      })),
    }));

    // Parse the instruction and match to available elements
    const lowerInstruction = instruction.toLowerCase();
    
    // Handle click instructions
    if (lowerInstruction.includes('click') || lowerInstruction.includes('press') || lowerInstruction.includes('tap')) {
      const target = this.extractTarget(instruction);
      const selector = this.findElementByAI(target, pageContent);
      if (selector) {
        await page.click(selector);
        logger.info(`AI clicked: ${selector}`);
        return;
      }
    }

    // Handle type/fill instructions
    if (lowerInstruction.includes('type') || lowerInstruction.includes('enter') || lowerInstruction.includes('fill') || lowerInstruction.includes('input')) {
      const { target, value } = this.extractTypeInstruction(instruction);
      const selector = this.findInputByAI(target, pageContent);
      if (selector && value) {
        await page.fill(selector, value);
        logger.info(`AI typed "${value}" into: ${selector}`);
        return;
      }
    }

    // Handle navigation instructions
    if (lowerInstruction.includes('go to') || lowerInstruction.includes('navigate') || lowerInstruction.includes('visit')) {
      const urlMatch = instruction.match(/(?:go to|navigate to|visit)\s+["']?([^\s"']+)["']?/i);
      if (urlMatch) {
        await page.goto(urlMatch[1]);
        logger.info(`AI navigated to: ${urlMatch[1]}`);
        return;
      }
    }

    // Handle wait instructions
    if (lowerInstruction.includes('wait')) {
      const timeMatch = instruction.match(/(\d+)\s*(seconds?|ms|milliseconds?)/i);
      if (timeMatch) {
        const time = parseInt(timeMatch[1]) * (timeMatch[2].startsWith('s') ? 1000 : 1);
        await page.waitForTimeout(time);
        logger.info(`AI waited: ${time}ms`);
        return;
      }
      // Wait for element
      const target = this.extractTarget(instruction);
      const selector = this.findElementByAI(target, pageContent);
      if (selector) {
        await page.waitForSelector(selector);
        logger.info(`AI waited for: ${selector}`);
        return;
      }
    }

    logger.warn(`AI could not interpret instruction: "${instruction}"`);
  }

  /**
   * Extract target element from instruction
   */
  private extractTarget(instruction: string): string {
    // Remove common action words and extract target
    return instruction
      .replace(/^(click|press|tap|on|the|button|link|element)\s+/gi, '')
      .replace(/\s+(button|link|element)$/gi, '')
      .trim();
  }

  /**
   * Extract type instruction components
   */
  private extractTypeInstruction(instruction: string): { target: string; value: string } {
    // Pattern: "type 'value' into field" or "enter value in input"
    const patterns = [
      /(?:type|enter|fill|input)\s+["']([^"']+)["']\s+(?:into|in|on)\s+(.+)/i,
      /(?:type|enter|fill|input)\s+(.+)\s+(?:into|in|on)\s+(.+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = instruction.match(pattern);
      if (match) {
        return { value: match[1], target: match[2] };
      }
    }
    
    return { target: '', value: '' };
  }

  /**
   * Find element using AI-like matching
   */
  private findElementByAI(target: string, pageContent: any): string | null {
    const lowerTarget = target.toLowerCase();

    // Search buttons
    for (const btn of pageContent.buttons) {
      if (btn.text.toLowerCase().includes(lowerTarget) || 
          btn.id?.toLowerCase().includes(lowerTarget)) {
        if (btn.id) return `#${btn.id}`;
        return `button:has-text("${btn.text}")`;
      }
    }

    // Search links
    for (const link of pageContent.links) {
      if (link.text.toLowerCase().includes(lowerTarget) ||
          link.id?.toLowerCase().includes(lowerTarget)) {
        if (link.id) return `#${link.id}`;
        return `a:has-text("${link.text}")`;
      }
    }

    return null;
  }

  /**
   * Find input element using AI-like matching
   */
  private findInputByAI(target: string, pageContent: any): string | null {
    const lowerTarget = target.toLowerCase();

    for (const input of pageContent.inputs) {
      if (input.label?.toLowerCase().includes(lowerTarget) ||
          input.placeholder?.toLowerCase().includes(lowerTarget) ||
          input.name?.toLowerCase().includes(lowerTarget) ||
          input.id?.toLowerCase().includes(lowerTarget)) {
        if (input.id) return `#${input.id}`;
        if (input.name) return `[name="${input.name}"]`;
        if (input.placeholder) return `[placeholder="${input.placeholder}"]`;
      }
    }

    return null;
  }

  /**
   * Try AI-powered healing using page context
   */
  private async tryAIHealing(page: Page, step: TestStep): Promise<string | null> {
    try {
      // Get surrounding DOM context for the failed selector
      const domContext = await page.evaluate((selector) => {
        // Try to find elements with similar attributes
        const body = document.body.innerHTML;
        return body.substring(0, 5000); // First 5KB of DOM for context
      }, step.selector);

      // Analyze the original selector to understand what we're looking for
      const selectorInfo = this.analyzeSelector(step.selector!);
      
      // Try to find similar elements based on selector type
      const alternatives = await page.evaluate((info) => {
        const results: string[] = [];
        
        // If looking for an ID, try data-testid or similar
        if (info.isId) {
          const idValue = info.value;
          const byTestId = document.querySelector(`[data-testid*="${idValue}"]`);
          if (byTestId) {
            const testId = byTestId.getAttribute('data-testid');
            results.push(`[data-testid="${testId}"]`);
          }
          
          // Try partial ID match
          const partialMatch = document.querySelector(`[id*="${idValue}"]`);
          if (partialMatch) {
            results.push(`#${partialMatch.id}`);
          }
        }
        
        // If looking for a class, try variations
        if (info.isClass) {
          const className = info.value;
          const byPartialClass = document.querySelector(`[class*="${className}"]`);
          if (byPartialClass) {
            results.push(`.${byPartialClass.className.split(' ')[0]}`);
          }
        }

        // If looking for text content, find similar text
        if (info.hasText) {
          const textElements = document.querySelectorAll('button, a, span, div, p, label');
          for (const el of textElements) {
            if (el.textContent?.toLowerCase().includes(info.text.toLowerCase())) {
              if (el.id) {
                results.push(`#${el.id}`);
              } else {
                results.push(`${el.tagName.toLowerCase()}:has-text("${el.textContent.trim().substring(0, 50)}")`);
              }
              break;
            }
          }
        }

        return results;
      }, selectorInfo);

      // Return first alternative that might work
      return alternatives.length > 0 ? alternatives[0] : null;
    } catch (error) {
      logger.debug('AI healing analysis failed:', error);
      return null;
    }
  }

  /**
   * Try LLM-powered healing: send a DOM snapshot + original selector to a real LLM
   * and ask it to suggest a replacement selector.
   */
  private async tryLLMHealing(
    page: any, // Playwright Page
    originalSelector: string,
    pageUrl: string
  ): Promise<string | null> {
    try {
      // Extract simplified DOM snapshot of interactive elements
      const domSnapshot = await page.evaluate(() => {
        const elements: string[] = [];
        const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="checkbox"], [role="radio"], [data-testid], [aria-label]';
        document.querySelectorAll(interactiveSelectors).forEach((el: Element) => {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const classes = el.className && typeof el.className === 'string'
            ? `.${el.className.split(' ').filter(Boolean).join('.')}` : '';
          const text = el.textContent?.trim().slice(0, 50) || '';
          const role = el.getAttribute('role') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const testId = el.getAttribute('data-testid') || '';
          const placeholder = (el as HTMLInputElement).placeholder || '';
          const name = el.getAttribute('name') || '';
          elements.push(
            `<${tag}${id}${classes}${role ? ` role="${role}"` : ''}${ariaLabel ? ` aria-label="${ariaLabel}"` : ''}${testId ? ` data-testid="${testId}"` : ''}${name ? ` name="${name}"` : ''}${placeholder ? ` placeholder="${placeholder}"` : ''}>${text}</${tag}>`
          );
        });
        return elements.slice(0, 100).join('\n'); // Cap at 100 elements
      });

      if (!domSnapshot || !this.aiService) return null;

      const response = await this.aiService.complete([
        { role: 'system', content: 'You are a web testing expert. A CSS/Playwright selector no longer matches any element on the page. Suggest a replacement selector. Respond with valid JSON only: { "selector": "...", "confidence": 0.0-1.0 }' },
        { role: 'user', content: `Original selector: ${originalSelector}\nPage URL: ${pageUrl}\n\nCurrent page DOM (interactive elements):\n${domSnapshot}` },
      ]);

      // Parse response — complete() returns { content, model, ... }
      const cleaned = response.content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.selector || typeof parsed.selector !== 'string') return null;

      // Validate the selector actually matches
      const element = await page.waitForSelector(parsed.selector, { timeout: 3000 }).catch(() => null);
      if (!element) return null;

      // Record the healing pattern
      await prisma.healingPattern.create({
        data: {
          originalSelector,
          healedSelector: parsed.selector,
          pagePattern: new URL(pageUrl).pathname,
          strategy: 'LLM_INFERENCE',
          confidence: parsed.confidence || 0.75,
        },
      }).catch(() => {}); // Don't fail the test over recording

      return parsed.selector;
    } catch (err) {
      logger.debug('LLM healing failed', { originalSelector, error: err });
      return null;
    }
  }

  /**
   * Analyze a CSS selector to understand its structure
   */
  private analyzeSelector(selector: string): {
    isId: boolean;
    isClass: boolean;
    hasText: boolean;
    value: string;
    text: string;
  } {
    const isId = selector.startsWith('#');
    const isClass = selector.startsWith('.');
    const hasTextMatch = selector.match(/:has-text\(["'](.+?)["']\)/);
    
    let value = '';
    if (isId) value = selector.substring(1);
    else if (isClass) value = selector.substring(1).split('.')[0];
    
    return {
      isId,
      isClass,
      hasText: !!hasTextMatch,
      value,
      text: hasTextMatch ? hasTextMatch[1] : '',
    };
  }

  private generateAlternativeSelectors(selector: string): string[] {
    const alternatives: string[] = [];

    // If ID selector, try data-testid
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      alternatives.push(`[data-testid="${id}"]`);
      alternatives.push(`[id*="${id}"]`);
      alternatives.push(`[name="${id}"]`);
    }

    // If class selector, try partial match
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      alternatives.push(`[class*="${className}"]`);
    }

    // If data-testid, try ID or name
    if (selector.includes('data-testid')) {
      const match = selector.match(/data-testid="([^"]+)"/);
      if (match) {
        alternatives.push(`#${match[1]}`);
        alternatives.push(`[name="${match[1]}"]`);
      }
    }

    return alternatives;
  }
}

// Playwright expect import
import { expect } from '@playwright/test';
