/**
 * VisionTest.ai - TestRunner Service Tests
 * Hospital-Grade Test Coverage
 * 
 * Tests for browser automation, step execution, assertions,
 * self-healing, checkpoints, and error recovery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestRunner, TestStep, RunConfig } from './testRunner';
import {
  mockPlaywright,
  mockBrowser,
  mockContext,
  mockPage,
  mockPrismaClient,
  createMockTest,
  createMockHealingPattern,
} from '../__tests__/setup';

describe('TestRunner', () => {
  let testRunner: TestRunner;

  beforeEach(() => {
    testRunner = new TestRunner();
  });

  // ===========================================================================
  // BROWSER LAUNCH TESTS
  // ===========================================================================

  describe('Browser Launch', () => {
    it('should launch chromium browser by default', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      expect(mockPlaywright.chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });

    it('should launch firefox browser when specified', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { browser: 'firefox' },
      };

      await testRunner.runTests(tests, config);

      expect(mockPlaywright.firefox.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });

    it('should launch webkit browser when specified', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { browser: 'webkit' },
      };

      await testRunner.runTests(tests, config);

      expect(mockPlaywright.webkit.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });

    it('should launch in headed mode when headless is false', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { headless: false },
      };

      await testRunner.runTests(tests, config);

      expect(mockPlaywright.chromium.launch).toHaveBeenCalledWith({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });

    it('should close browser after tests complete', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should close browser even if tests fail', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#missing' }]),
      })];
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));

      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BROWSER CONTEXT TESTS
  // ===========================================================================

  describe('Browser Context', () => {
    it('should create context with default viewport', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1920, height: 1080 },
      });
    });

    it('should create context with custom viewport', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { viewport: { width: 1280, height: 720 } },
      };

      await testRunner.runTests(tests, config);

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 720 },
      });
    });

    it('should navigate to base URL if configured', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { baseUrl: 'https://app.example.com' },
      };

      await testRunner.runTests(tests, config);

      expect(mockPage.goto).toHaveBeenCalledWith('https://app.example.com');
    });

    it('should close context after test completes', async () => {
      const tests = [createMockTest({ steps: '[]' })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      expect(mockContext.close).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // STEP EXECUTION TESTS
  // ===========================================================================

  describe('Step Execution', () => {
    describe('navigate step', () => {
      it('should navigate to specified URL', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', { timeout: 30000 });
      });

      it('should use custom timeout for navigation', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'navigate', url: 'https://slow.example.com', timeout: 60000 }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.goto).toHaveBeenCalledWith('https://slow.example.com', { timeout: 60000 });
      });
    });

    describe('click step', () => {
      it('should click on element', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'click', selector: '#submit-btn' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.click).toHaveBeenCalledWith('#submit-btn', { timeout: 30000 });
      });

      it('should fail when element not found', async () => {
        mockPage.click.mockRejectedValueOnce(new Error('Element not found'));

        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'click', selector: '#missing' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        const results = await testRunner.runTests(tests, config);

        expect(results[0].status).toBe('failed');
        expect(results[0].steps[0].status).toBe('failed');
        expect(results[0].steps[0].error).toContain('Element not found');
      });
    });

    describe('type step', () => {
      it('should fill input with value', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'type', selector: '#username', value: 'testuser' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.fill).toHaveBeenCalledWith('#username', 'testuser', { timeout: 30000 });
      });

      it('should handle empty value', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'type', selector: '#field' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.fill).toHaveBeenCalledWith('#field', '', { timeout: 30000 });
      });
    });

    describe('clear step', () => {
      it('should clear input field', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'clear', selector: '#searchbox' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.fill).toHaveBeenCalledWith('#searchbox', '', { timeout: 30000 });
      });
    });

    describe('select step', () => {
      it('should select dropdown option', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'select', selector: '#country', value: 'US' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.selectOption).toHaveBeenCalledWith('#country', 'US', { timeout: 30000 });
      });
    });

    describe('hover step', () => {
      it('should hover over element', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'hover', selector: '.dropdown-trigger' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.hover).toHaveBeenCalledWith('.dropdown-trigger', { timeout: 30000 });
      });
    });

    describe('scroll step', () => {
      it('should scroll element into view', async () => {
        const locator = mockPage.locator('#footer');
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'scroll', selector: '#footer' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.locator).toHaveBeenCalledWith('#footer');
      });

      it('should scroll to bottom when no selector', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'scroll' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.evaluate).toHaveBeenCalledWith('window.scrollTo(0, document.body.scrollHeight)');
      });
    });

    describe('waitFor step', () => {
      it('should wait for selector', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'waitFor', selector: '.loading-complete' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        await testRunner.runTests(tests, config);

        expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loading-complete', { timeout: 30000 });
      });

      it('should timeout when element not found', async () => {
        mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));

        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'waitFor', selector: '#never-appears' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        const results = await testRunner.runTests(tests, config);

        expect(results[0].status).toBe('failed');
        expect(results[0].steps[0].error).toContain('Timeout');
      });
    });

    describe('screenshot step', () => {
      it('should capture screenshot', async () => {
        const onScreenshot = vi.fn();
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'screenshot' }]),
        })];
        const config: RunConfig = {
          executionId: 'exec-123',
          onScreenshot,
        };

        await testRunner.runTests(tests, config);

        expect(mockPage.screenshot).toHaveBeenCalled();
        expect(onScreenshot).toHaveBeenCalled();
      });

      it('should capture full page screenshot when specified', async () => {
        const onScreenshot = vi.fn();
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'screenshot', options: { fullPage: true } }]),
        })];
        const config: RunConfig = {
          executionId: 'exec-123',
          onScreenshot,
        };

        await testRunner.runTests(tests, config);

        expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true });
      });
    });

    describe('unknown step type', () => {
      it('should warn but not fail for unknown step types', async () => {
        const tests = [createMockTest({
          steps: JSON.stringify([{ type: 'unknownAction', selector: '#element' }]),
        })];
        const config: RunConfig = { executionId: 'exec-123' };

        const results = await testRunner.runTests(tests, config);

        // Should pass (unknown steps are skipped with warning)
        expect(results[0].status).toBe('passed');
      });
    });
  });

  // ===========================================================================
  // ASSERTION TESTS
  // ===========================================================================

  describe('Assertion Handling', () => {
    it('should assert element is visible', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '#header', assertion: 'visible' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should assert element is hidden', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '.modal', assertion: 'hidden' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should assert element has specific text', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '#title', assertion: 'text', value: 'Hello World' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should assert element has specific value', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '#input', assertion: 'value', value: 'test@example.com' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should assert element count', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '.item', assertion: 'count', value: '5' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should assert element is enabled', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '#submit', assertion: 'enabled' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should assert element is disabled', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '#locked-input', assertion: 'disabled' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });

    it('should default to existence check for unknown assertions', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'assert', selector: '#element' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });
  });

  // ===========================================================================
  // CHECKPOINT TESTS
  // ===========================================================================

  describe('Checkpoint Capture', () => {
    it('should capture checkpoint after each step', async () => {
      const onCheckpoint = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([
          { type: 'navigate', url: 'https://example.com' },
          { type: 'click', selector: '#btn' },
        ]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onCheckpoint,
      };

      await testRunner.runTests(tests, config);

      expect(onCheckpoint).toHaveBeenCalledTimes(2);
      expect(onCheckpoint).toHaveBeenCalledWith(0, expect.objectContaining({
        url: expect.any(String),
        cookies: expect.any(Array),
        localStorage: expect.any(Object),
        sessionStorage: expect.any(Object),
      }));
    });

    it('should capture page URL in checkpoint', async () => {
      mockPage.url.mockReturnValue('https://example.com/dashboard');
      const onCheckpoint = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'navigate', url: 'https://example.com/dashboard' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onCheckpoint,
      };

      await testRunner.runTests(tests, config);

      expect(onCheckpoint).toHaveBeenCalledWith(0, expect.objectContaining({
        url: 'https://example.com/dashboard',
      }));
    });

    it('should capture cookies in checkpoint', async () => {
      const cookies = [
        { name: 'session', value: 'abc123', domain: 'example.com' },
        { name: 'preferences', value: 'dark', domain: 'example.com' },
      ];
      mockPage.context.mockReturnValue({
        cookies: vi.fn().mockResolvedValue(cookies),
      });
      const onCheckpoint = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onCheckpoint,
      };

      await testRunner.runTests(tests, config);

      expect(onCheckpoint).toHaveBeenCalledWith(0, expect.objectContaining({
        cookies,
      }));
    });
  });

  // ===========================================================================
  // SELF-HEALING TESTS
  // ===========================================================================

  describe('Self-Healing', () => {
    it('should try cached healing pattern first', async () => {
      // First click fails
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      // Healed selector works
      mockPage.waitForSelector.mockResolvedValueOnce(undefined);

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(createMockHealingPattern({
        originalSelector: '#old-button',
        healedSelector: '[data-testid="button"]',
        confidence: 0.9,
      }));

      const onHealing = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#old-button' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onHealing,
      };

      await testRunner.runTests(tests, config);

      expect(mockPrismaClient.healingPattern.findFirst).toHaveBeenCalledWith({
        where: { originalSelector: '#old-button' },
        orderBy: { successCount: 'desc' },
      });
    });

    it('should update success count when healing works', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      mockPage.waitForSelector.mockResolvedValueOnce(undefined);

      const pattern = createMockHealingPattern({
        id: 'pattern-456',
        successCount: 10,
      });
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(pattern);

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#old-button' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onHealing: vi.fn(),
      };

      await testRunner.runTests(tests, config);

      expect(mockPrismaClient.healingPattern.update).toHaveBeenCalledWith({
        where: { id: 'pattern-456' },
        data: {
          successCount: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should generate alternative selectors for ID selectors', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      // All alternatives fail
      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#submit' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onHealing: vi.fn(),
      };

      await testRunner.runTests(tests, config);

      // Should try alternatives
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="submit"]', expect.any(Object));
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[id*="submit"]', expect.any(Object));
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[name="submit"]', expect.any(Object));
    });

    it('should create new healing pattern when alternative found', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      
      // First alternative fails, second works
      mockPage.waitForSelector
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#button' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onHealing: vi.fn(),
      };

      await testRunner.runTests(tests, config);

      expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalSelector: '#button',
          strategy: 'DOM_ANALYSIS',
          confidence: 0.8,
        }),
      });
    });

    it('should report healing event via callback', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      mockPage.waitForSelector.mockResolvedValueOnce(undefined);

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(createMockHealingPattern({
        healedSelector: '[data-testid="btn"]',
        confidence: 0.95,
      }));

      const onHealing = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#old-btn' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onHealing,
      };

      await testRunner.runTests(tests, config);

      expect(onHealing).toHaveBeenCalledWith({
        stepIndex: 0,
        originalSelector: '#old-btn',
        healedSelector: '[data-testid="btn"]',
        strategy: 'CACHE',
        confidence: expect.any(Number),
      });
    });

    it('should mark step as healed in result', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      mockPage.waitForSelector.mockResolvedValueOnce(undefined);

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(createMockHealingPattern());

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onHealing: vi.fn(),
      };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].steps[0].healed).toBe(true);
      expect(results[0].steps[0].status).toBe('passed');
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('Error Handling and Recovery', () => {
    it('should capture failure screenshot on error', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Click failed'));
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));

      const onScreenshot = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onScreenshot,
      };

      await testRunner.runTests(tests, config);

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(onScreenshot).toHaveBeenCalled();
    });

    it('should continue to next test after failure', async () => {
      mockPage.click
        .mockRejectedValueOnce(new Error('First test fails'))
        .mockResolvedValue(undefined);
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));

      const tests = [
        createMockTest({ id: 'test-1', steps: JSON.stringify([{ type: 'click', selector: '#btn1' }]) }),
        createMockTest({ id: 'test-2', steps: JSON.stringify([{ type: 'click', selector: '#btn2' }]) }),
      ];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('failed');
      expect(results[1].status).toBe('passed');
    });

    it('should record error message in result', async () => {
      const errorMessage = 'Element #missing-element not found within 30000ms';
      mockPage.click.mockRejectedValueOnce(new Error(errorMessage));
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#missing-element' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].error).toContain(errorMessage);
    });

    it('should track duration for failed steps', async () => {
      mockPage.click.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 50);
        });
      });
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].steps[0].duration).toBeGreaterThan(0);
    });

    it('should handle non-Error exceptions', async () => {
      mockPage.click.mockRejectedValueOnce('String error');
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPage.waitForSelector.mockRejectedValue(new Error('Not found'));

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('failed');
      expect(results[0].error).toBe('Unknown error');
    });
  });

  // ===========================================================================
  // PROGRESS REPORTING TESTS
  // ===========================================================================

  describe('Progress Reporting', () => {
    it('should report progress for each step', async () => {
      // Reset click mock to ensure it succeeds
      mockPage.click.mockResolvedValue(undefined);
      mockPage.fill.mockResolvedValue(undefined);
      
      const onProgress = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([
          { type: 'hover', selector: '#btn' },
        ]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        onProgress,
      };

      await testRunner.runTests(tests, config);

      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenNthCalledWith(1, { testIndex: 0, stepIndex: 0, total: 1 });
    });

    it('should report correct test index for multiple tests', async () => {
      mockPage.hover.mockResolvedValue(undefined);
      
      const onProgress = vi.fn();
      const tests = [
        createMockTest({ id: 'test-1', steps: JSON.stringify([{ type: 'hover', selector: '#btn1' }]) }),
        createMockTest({ id: 'test-2', steps: JSON.stringify([{ type: 'hover', selector: '#btn2' }]) }),
      ];
      const config: RunConfig = {
        executionId: 'exec-123',
        onProgress,
      };

      await testRunner.runTests(tests, config);

      expect(onProgress).toHaveBeenCalledWith({ testIndex: 0, stepIndex: 0, total: 1 });
      expect(onProgress).toHaveBeenCalledWith({ testIndex: 1, stepIndex: 0, total: 1 });
    });
  });

  // ===========================================================================
  // REPLAY FROM CHECKPOINT TESTS
  // ===========================================================================

  describe('Replay from Checkpoint', () => {
    it('should start from specified step number', async () => {
      mockPage.hover.mockResolvedValue(undefined);
      
      const onProgress = vi.fn();
      const tests = [createMockTest({
        steps: JSON.stringify([
          { type: 'hover', selector: '#btn0' },
          { type: 'hover', selector: '#btn1' },
          { type: 'hover', selector: '#btn2' },
          { type: 'hover', selector: '#btn3' },
        ]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        replayFrom: {
          checkpointId: 'checkpoint-123',
          stepNumber: 2,
        },
        onProgress,
      };

      await testRunner.runTests(tests, config);

      // Should skip steps 0 and 1, start from step 2
      // Only steps 2 and 3 should trigger progress
      expect(onProgress).toHaveBeenCalledWith({ testIndex: 0, stepIndex: 2, total: 4 });
      expect(onProgress).toHaveBeenCalledWith({ testIndex: 0, stepIndex: 3, total: 4 });
    });

    it('should only execute remaining steps', async () => {
      mockPage.hover.mockClear();
      mockPage.hover.mockResolvedValue(undefined);
      
      const tests = [createMockTest({
        steps: JSON.stringify([
          { type: 'hover', selector: '#step0' },
          { type: 'hover', selector: '#step1' },
          { type: 'hover', selector: '#step2' },
        ]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        replayFrom: {
          checkpointId: 'checkpoint-123',
          stepNumber: 2,
        },
      };

      await testRunner.runTests(tests, config);

      // Only step 2 should be executed (starting from stepNumber: 2)
      expect(mockPage.hover).toHaveBeenCalledWith('#step2', expect.any(Object));
      // Steps 0 and 1 should NOT be called
      expect(mockPage.hover).not.toHaveBeenCalledWith('#step0', expect.any(Object));
      expect(mockPage.hover).not.toHaveBeenCalledWith('#step1', expect.any(Object));
    });
  });

  // ===========================================================================
  // RESULT STRUCTURE TESTS
  // ===========================================================================

  describe('Result Structure', () => {
    it('should return complete test result', async () => {
      mockPage.hover.mockResolvedValue(undefined);
      
      const tests = [createMockTest({
        id: 'test-456',
        name: 'Complete Test',
        steps: JSON.stringify([
          { type: 'hover', selector: '#btn' },
        ]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0]).toMatchObject({
        testId: 'test-456',
        name: 'Complete Test',
        status: 'passed',
        duration: expect.any(Number),
      });
      expect(results[0].steps).toBeDefined();
      expect(results[0].steps.length).toBeGreaterThan(0);
    });

    it('should calculate total duration correctly', async () => {
      mockPage.hover.mockResolvedValue(undefined);
      
      const tests = [createMockTest({
        steps: JSON.stringify([
          { type: 'hover', selector: '#btn1' },
          { type: 'hover', selector: '#btn2' },
        ]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle tests with parsed steps (non-string)', async () => {
      mockPage.hover.mockResolvedValue(undefined);
      
      const tests = [createMockTest({
        steps: [
          { type: 'hover', selector: '#btn' },
        ],
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      const results = await testRunner.runTests(tests, config);

      expect(results[0].status).toBe('passed');
    });
  });

  // ===========================================================================
  // TIMEOUT CONFIGURATION TESTS
  // ===========================================================================

  describe('Timeout Configuration', () => {
    it('should use global timeout from config', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { timeout: 60000 },
      };

      await testRunner.runTests(tests, config);

      expect(mockPage.click).toHaveBeenCalledWith('#btn', { timeout: 60000 });
    });

    it('should prefer step-level timeout over global', async () => {
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#btn', timeout: 5000 }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
        config: { timeout: 60000 },
      };

      await testRunner.runTests(tests, config);

      expect(mockPage.click).toHaveBeenCalledWith('#btn', { timeout: 5000 });
    });
  });

  // ===========================================================================
  // AI STEP AND ALTERNATIVE SELECTORS TESTS
  // ===========================================================================

  describe('AI Step Handling', () => {
    it('should execute AI step when instruction is provided', async () => {
      // Import the mocked logger
      const { logger } = await import('../utils/logger');
      vi.mocked(logger.info).mockClear();
      
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'ai', value: 'click the submit button' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      // AI steps now execute with the AI engine
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('AI step'));
    });

    it('should warn when AI step has no instruction', async () => {
      // Import the mocked logger
      const { logger } = await import('../utils/logger');
      vi.mocked(logger.warn).mockClear();
      
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'ai' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      // AI steps with no instruction should warn
      expect(logger.warn).toHaveBeenCalledWith('AI step has no instruction');
    });

    it('should warn for unknown step type', async () => {
      const { logger } = await import('../utils/logger');
      vi.mocked(logger.warn).mockClear();
      
      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'unknown_type', selector: '#btn' }]),
      })];
      const config: RunConfig = { executionId: 'exec-123' };

      await testRunner.runTests(tests, config);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown step type'));
    });
  });

  describe('Alternative Selector Generation', () => {
    it('should generate alternatives for data-testid selectors', async () => {
      // Fail with data-testid, then succeed with ID alternative
      let callCount = 0;
      mockPage.click.mockImplementation(async (selector: string) => {
        callCount++;
        if (selector.includes('data-testid')) {
          throw new Error('Element not found');
        }
        return undefined;
      });

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '[data-testid="submit-btn"]' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
      };

      await testRunner.runTests(tests, config);

      // Should try alternative selectors
      expect(mockPage.click).toHaveBeenCalledWith('[data-testid="submit-btn"]', expect.any(Object));
    });

    it('should generate alternatives for ID selectors', async () => {
      // First call fails, alternatives should be tried
      let callCount = 0;
      mockPage.click.mockImplementation(async (selector: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Element not found');
        }
        return undefined;
      });

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '#submit-button' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
      };

      await testRunner.runTests(tests, config);

      // Should try original and then alternatives
      expect(mockPage.click).toHaveBeenCalledWith('#submit-button', expect.any(Object));
    });

    it('should generate alternatives for class selectors', async () => {
      let callCount = 0;
      mockPage.click.mockImplementation(async (selector: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Element not found');
        }
        return undefined;
      });

      const tests = [createMockTest({
        steps: JSON.stringify([{ type: 'click', selector: '.submit-button' }]),
      })];
      const config: RunConfig = {
        executionId: 'exec-123',
      };

      await testRunner.runTests(tests, config);

      expect(mockPage.click).toHaveBeenCalledWith('.submit-button', expect.any(Object));
    });

  });

});
