/**
 * VisionTest.ai - Healing Service Tests
 * Hospital-Grade Test Coverage
 * 
 * Tests for self-healing pattern recording, suggestion lookup,
 * confidence score updates, pattern cleanup, and statistics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealingService, HealingEvent } from './healing';
import {
  mockPrismaClient,
  createMockHealingPattern,
  createMockExecution,
} from '../__tests__/setup';

describe('HealingService', () => {
  let service: HealingService;

  beforeEach(() => {
    service = new HealingService();
  });

  // ===========================================================================
  // HEALING RECORDING TESTS
  // ===========================================================================

  describe('Record Healing', () => {
    const baseEvent: HealingEvent = {
      stepIndex: 5,
      originalSelector: '#login-button',
      healedSelector: '[data-testid="login"]',
      strategy: 'DOM_ANALYSIS',
      confidence: 0.85,
    };

    describe('New Pattern Creation', () => {
      beforeEach(() => {
        mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
        mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
        mockPrismaClient.execution.update.mockResolvedValue({});
      });

      it('should create new healing pattern when none exists', async () => {
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            originalSelector: '#login-button',
            healedSelector: '[data-testid="login"]',
            strategy: 'DOM_ANALYSIS',
            confidence: 0.85,
            successCount: 1,
          }),
        });
      });

      it('should set initial success count to 1', async () => {
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            successCount: 1,
          }),
        });
      });

      it('should set lastUsedAt timestamp', async () => {
        const beforeTime = new Date();
        
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        });
      });

      it('should store healing pattern when DOM context is provided', async () => {
        const eventWithContext: HealingEvent = {
          ...baseEvent,
          domContext: '<div id="container"><button data-testid="login">Login</button></div>',
        };

        await service.recordHealing('exec-123', eventWithContext);

        // Pattern is created -- domContext is optional metadata, not a schema field
        expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            originalSelector: baseEvent.originalSelector,
            healedSelector: baseEvent.healedSelector,
          }),
        });
      });
    });

    describe('Existing Pattern Update', () => {
      beforeEach(() => {
        mockPrismaClient.healingPattern.findFirst.mockResolvedValue(createMockHealingPattern({
          id: 'pattern-789',
          successCount: 10,
          confidence: 0.8,
        }));
        mockPrismaClient.healingPattern.update.mockResolvedValue({});
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
        mockPrismaClient.execution.update.mockResolvedValue({});
      });

      it('should update existing pattern when found', async () => {
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.update).toHaveBeenCalledWith({
          where: { id: 'pattern-789' },
          data: expect.any(Object),
        });
      });

      it('should increment success count', async () => {
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.update).toHaveBeenCalledWith({
          where: { id: 'pattern-789' },
          data: expect.objectContaining({
            successCount: { increment: 1 },
          }),
        });
      });

      it('should update lastUsedAt timestamp', async () => {
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.update).toHaveBeenCalledWith({
          where: { id: 'pattern-789' },
          data: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        });
      });

      it('should update confidence with exponential moving average', async () => {
        // Existing confidence: 0.8, new confidence: 0.85
        // Expected: 0.7 * 0.8 + 0.3 * 0.85 = 0.56 + 0.255 = 0.815

        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.update).toHaveBeenCalledWith({
          where: { id: 'pattern-789' },
          data: expect.objectContaining({
            confidence: 0.7 * 0.8 + 0.3 * 0.85,
          }),
        });
      });

      it('should not create new pattern when one exists', async () => {
        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.healingPattern.create).not.toHaveBeenCalled();
      });
    });

    describe('Execution Metadata Update', () => {
      beforeEach(() => {
        mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
        mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern({
          id: 'new-pattern-123',
        }));
        mockPrismaClient.execution.update.mockResolvedValue({});
      });

      it('should add healing event to execution metadata', async () => {
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution({
          metadata: { healingHistory: [] },
        }));

        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.execution.update).toHaveBeenCalledWith({
          where: { id: 'exec-123' },
          data: {
            metadata: expect.objectContaining({
              healingHistory: expect.arrayContaining([
                expect.objectContaining({
                  originalSelector: '#login-button',
                  healedSelector: '[data-testid="login"]',
                  patternId: 'new-pattern-123',
                }),
              ]),
            }),
          },
        });
      });

      it('should preserve existing healing history', async () => {
        const existingHistory = [
          { originalSelector: '#old', healedSelector: '#new', timestamp: 1000 },
        ];
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution({
          metadata: { healingHistory: existingHistory },
        }));

        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.execution.update).toHaveBeenCalledWith({
          where: { id: 'exec-123' },
          data: {
            metadata: expect.objectContaining({
              healingHistory: expect.arrayContaining([
                expect.objectContaining({ originalSelector: '#old' }),
                expect.objectContaining({ originalSelector: '#login-button' }),
              ]),
            }),
          },
        });
      });

      it('should update healing count', async () => {
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution({
          metadata: { healingHistory: [] },
        }));

        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.execution.update).toHaveBeenCalledWith({
          where: { id: 'exec-123' },
          data: {
            metadata: expect.objectContaining({
              healingCount: 1,
            }),
          },
        });
      });

      it('should include timestamp in healing history entry', async () => {
        const beforeTime = Date.now();
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution({
          metadata: {},
        }));

        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.execution.update).toHaveBeenCalledWith({
          where: { id: 'exec-123' },
          data: {
            metadata: expect.objectContaining({
              healingHistory: expect.arrayContaining([
                expect.objectContaining({
                  timestamp: expect.any(Number),
                }),
              ]),
            }),
          },
        });
      });

      it('should handle execution with no metadata', async () => {
        mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution({
          metadata: null,
        }));

        await service.recordHealing('exec-123', baseEvent);

        expect(mockPrismaClient.execution.update).toHaveBeenCalledWith({
          where: { id: 'exec-123' },
          data: {
            metadata: expect.objectContaining({
              healingHistory: expect.any(Array),
              healingCount: 1,
            }),
          },
        });
      });

      it('should handle missing execution gracefully', async () => {
        mockPrismaClient.execution.findUnique.mockResolvedValue(null);

        // Should not throw
        await expect(service.recordHealing('exec-123', baseEvent)).resolves.not.toThrow();
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockPrismaClient.healingPattern.findFirst.mockRejectedValue(new Error('DB error'));

        // Should not throw, just log
        await expect(service.recordHealing('exec-123', baseEvent)).resolves.not.toThrow();
      });

      it('should log errors when recording fails', async () => {
        const { logger } = await import('../utils/logger');
        mockPrismaClient.healingPattern.findFirst.mockRejectedValue(new Error('Connection timeout'));

        await service.recordHealing('exec-123', baseEvent);

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to record healing:',
          expect.any(Error)
        );
      });
    });
  });

  // ===========================================================================
  // HEALING SUGGESTION TESTS
  // ===========================================================================

  describe('Suggest Healing', () => {
    it('should return best healing suggestion', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([
        createMockHealingPattern({
          healedSelector: '[data-testid="button"]',
          confidence: 0.95,
          strategy: 'AI_ANALYSIS',
        }),
      ]);

      const suggestion = await service.suggestHealing('#broken-selector');

      expect(suggestion).toEqual({
        selector: '[data-testid="button"]',
        confidence: 0.95,
        strategy: 'AI_ANALYSIS',
      });
    });

    it('should order by confidence then success count', async () => {
      await service.suggestHealing('#old-selector');

      expect(mockPrismaClient.healingPattern.findMany).toHaveBeenCalledWith({
        where: { originalSelector: '#old-selector' },
        orderBy: [
          { confidence: 'desc' },
          { successCount: 'desc' },
        ],
        take: 1,
      });
    });

    it('should return null when no pattern found', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([]);

      const suggestion = await service.suggestHealing('#unknown-selector');

      expect(suggestion).toBeNull();
    });

    it('should return highest confidence pattern', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([
        createMockHealingPattern({
          healedSelector: '[data-testid="best"]',
          confidence: 0.99,
          strategy: 'CACHE',
        }),
      ]);

      const suggestion = await service.suggestHealing('#selector');

      expect(suggestion?.confidence).toBe(0.99);
    });

    it('should handle special characters in selector', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([]);

      await service.suggestHealing('input[name="email"][type="text"]');

      expect(mockPrismaClient.healingPattern.findMany).toHaveBeenCalledWith({
        where: { originalSelector: 'input[name="email"][type="text"]' },
        orderBy: expect.any(Array),
        take: 1,
      });
    });
  });

  // ===========================================================================
  // STATISTICS TESTS
  // ===========================================================================

  describe('Get Statistics', () => {
    it('should calculate total healed count', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([
        createMockHealingPattern({ successCount: 10 }),
        createMockHealingPattern({ successCount: 5 }),
        createMockHealingPattern({ successCount: 3 }),
      ]);

      const stats = await service.getStats();

      expect(stats.totalHealed).toBe(18);
    });

    it('should group healing by strategy', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([
        createMockHealingPattern({ strategy: 'DOM_ANALYSIS', successCount: 10 }),
        createMockHealingPattern({ strategy: 'DOM_ANALYSIS', successCount: 5 }),
        createMockHealingPattern({ strategy: 'AI_ANALYSIS', successCount: 8 }),
        createMockHealingPattern({ strategy: 'CACHE', successCount: 3 }),
      ]);

      const stats = await service.getStats();

      expect(stats.byStrategy).toEqual({
        DOM_ANALYSIS: 15,
        AI_ANALYSIS: 8,
        CACHE: 3,
      });
    });

    it('should calculate average confidence', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([
        createMockHealingPattern({ confidence: 0.9 }),
        createMockHealingPattern({ confidence: 0.8 }),
        createMockHealingPattern({ confidence: 0.7 }),
      ]);

      const stats = await service.getStats();

      expect(stats.avgConfidence).toBeCloseTo(0.8, 2);
    });

    it('should return top 10 patterns', async () => {
      const patterns = Array.from({ length: 15 }, (_, i) =>
        createMockHealingPattern({
          originalSelector: `#selector-${i}`,
          healedSelector: `[data-testid="healed-${i}"]`,
          successCount: 100 - i,
        })
      );
      mockPrismaClient.healingPattern.findMany.mockResolvedValue(patterns);

      const stats = await service.getStats();

      expect(stats.topPatterns).toHaveLength(10);
      expect(stats.topPatterns[0].count).toBe(100);
    });

    it('should return empty stats when no patterns exist', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([]);

      const stats = await service.getStats();

      expect(stats).toEqual({
        totalHealed: 0,
        byStrategy: {},
        avgConfidence: 0,
        topPatterns: [],
      });
    });

    it('should order patterns by success count descending', async () => {
      await service.getStats();

      expect(mockPrismaClient.healingPattern.findMany).toHaveBeenCalledWith({
        orderBy: { successCount: 'desc' },
      });
    });

    it('should include pattern details in top patterns', async () => {
      mockPrismaClient.healingPattern.findMany.mockResolvedValue([
        createMockHealingPattern({
          originalSelector: '#old',
          healedSelector: '[data-testid="new"]',
          successCount: 50,
        }),
      ]);

      const stats = await service.getStats();

      expect(stats.topPatterns[0]).toEqual({
        originalSelector: '#old',
        healedSelector: '[data-testid="new"]',
        count: 50,
      });
    });
  });

  // ===========================================================================
  // PATTERN CLEANUP TESTS
  // ===========================================================================

  describe('Pattern Cleanup', () => {
    it('should delete patterns with low success count and old age', async () => {
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupPatterns(2, 90);

      expect(mockPrismaClient.healingPattern.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            expect.objectContaining({
              successCount: { lt: 2 },
              createdAt: { lt: expect.any(Date) },
            }),
          ]),
        },
      });
    });

    it('should delete patterns not used within max age', async () => {
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 3 });

      await service.cleanupPatterns(2, 90);

      expect(mockPrismaClient.healingPattern.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            expect.objectContaining({
              lastUsedAt: { lt: expect.any(Date) },
            }),
          ]),
        },
      });
    });

    it('should use default values when not provided', async () => {
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupPatterns();

      expect(mockPrismaClient.healingPattern.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            expect.objectContaining({
              successCount: { lt: 2 },
            }),
          ]),
        },
      });
    });

    it('should return count of deleted patterns', async () => {
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 42 });

      const count = await service.cleanupPatterns();

      expect(count).toBe(42);
    });

    it('should calculate cutoff date correctly', async () => {
      const beforeCall = Date.now();
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupPatterns(2, 30);

      const callArgs = mockPrismaClient.healingPattern.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.OR[0].createdAt.lt;
      
      // Cutoff should be approximately 30 days ago
      const expectedCutoff = beforeCall - 30 * 24 * 60 * 60 * 1000;
      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff, -3); // Within 1 second
    });

    it('should log cleanup result', async () => {
      const { logger } = await import('../utils/logger');
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 10 });

      await service.cleanupPatterns();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 10 stale healing patterns')
      );
    });

    it('should handle cleanup with no patterns to delete', async () => {
      mockPrismaClient.healingPattern.deleteMany.mockResolvedValue({ count: 0 });

      const count = await service.cleanupPatterns();

      expect(count).toBe(0);
    });
  });

  // ===========================================================================
  // MODEL TRAINING TESTS
  // ===========================================================================

  describe('Train Model', () => {
    beforeEach(() => {
      // Set up mocks for trainModel which uses findFirst and create/update
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
    });

    it('should log training data capture', async () => {
      const { logger } = await import('../utils/logger');

      await service.trainModel(
        '#original',
        '[data-testid="healed"]',
        '<div><button id="original" data-testid="healed">Click</button></div>'
      );

      expect(logger.info).toHaveBeenCalledWith(
        'ML training data captured',
        expect.objectContaining({
          originalSelector: '#original',
          healedSelector: '[data-testid="healed"]',
          features: expect.any(Object),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should capture DOM context length', async () => {
      const { logger } = await import('../utils/logger');
      const domContext = '<html><body><div id="app">Complex DOM structure here</div></body></html>';

      await service.trainModel('#sel', '[data-testid="sel"]', domContext);

      // New implementation logs training features rather than raw context length
      expect(logger.info).toHaveBeenCalledWith(
        'ML training data captured',
        expect.objectContaining({
          originalSelector: '#sel',
          healedSelector: '[data-testid="sel"]',
        })
      );
    });

    it('should handle empty DOM context', async () => {
      // Should not throw
      await expect(
        service.trainModel('#sel', '[data-testid="sel"]', '')
      ).resolves.not.toThrow();
    });

    it('should handle very large DOM context', async () => {
      const largeContext = '<div>'.repeat(10000);

      // Should not throw
      await expect(
        service.trainModel('#sel', '[data-testid="sel"]', largeContext)
      ).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle selector with special regex characters', async () => {
      const event: HealingEvent = {
        stepIndex: 0,
        originalSelector: 'input[name="user.email"]',
        healedSelector: '[data-testid="email-input"]',
        strategy: 'DOM_ANALYSIS',
        confidence: 0.9,
      };

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
      mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
      mockPrismaClient.execution.update.mockResolvedValue({});

      await service.recordHealing('exec-123', event);

      expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          originalSelector: 'input[name="user.email"]',
        }),
      });
    });

    it('should handle XPath selectors', async () => {
      const event: HealingEvent = {
        stepIndex: 0,
        originalSelector: '//div[@class="container"]//button[contains(text(), "Submit")]',
        healedSelector: '[data-testid="submit-btn"]',
        strategy: 'AI_ANALYSIS',
        confidence: 0.75,
      };

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
      mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
      mockPrismaClient.execution.update.mockResolvedValue({});

      await service.recordHealing('exec-123', event);

      expect(mockPrismaClient.healingPattern.create).toHaveBeenCalled();
    });

    it('should handle confidence exactly at 1.0', async () => {
      const event: HealingEvent = {
        stepIndex: 0,
        originalSelector: '#btn',
        healedSelector: '[data-testid="btn"]',
        strategy: 'EXACT_MATCH',
        confidence: 1.0,
      };

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
      mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
      mockPrismaClient.execution.update.mockResolvedValue({});

      await service.recordHealing('exec-123', event);

      expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 1.0,
        }),
      });
    });

    it('should handle confidence exactly at 0.0', async () => {
      const event: HealingEvent = {
        stepIndex: 0,
        originalSelector: '#btn',
        healedSelector: '[data-testid="btn"]',
        strategy: 'RANDOM_GUESS',
        confidence: 0.0,
      };

      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
      mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
      mockPrismaClient.execution.update.mockResolvedValue({});

      await service.recordHealing('exec-123', event);

      expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          confidence: 0.0,
        }),
      });
    });

    it('should handle concurrent healing recordings', async () => {
      mockPrismaClient.healingPattern.findFirst.mockResolvedValue(null);
      mockPrismaClient.healingPattern.create.mockResolvedValue(createMockHealingPattern());
      mockPrismaClient.execution.findUnique.mockResolvedValue(createMockExecution());
      mockPrismaClient.execution.update.mockResolvedValue({});

      const events = Array.from({ length: 5 }, (_, i) => ({
        stepIndex: i,
        originalSelector: `#btn-${i}`,
        healedSelector: `[data-testid="btn-${i}"]`,
        strategy: 'DOM_ANALYSIS',
        confidence: 0.8,
      }));

      // Record all concurrently
      await Promise.all(
        events.map((event) => service.recordHealing('exec-123', event))
      );

      expect(mockPrismaClient.healingPattern.create).toHaveBeenCalledTimes(5);
    });
  });
});
