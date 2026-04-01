// VisionTest.ai - Self-Healing Service
// Detects and heals broken selectors automatically

import { prisma } from '@visiontest/database';
import { logger } from '../utils/logger';

export interface HealingEvent {
  stepIndex: number;
  originalSelector: string;
  healedSelector: string;
  strategy: string;
  confidence: number;
  domContext?: string;
}

export interface HealingStats {
  totalHealed: number;
  byStrategy: Record<string, number>;
  avgConfidence: number;
  topPatterns: Array<{
    originalSelector: string;
    healedSelector: string;
    count: number;
  }>;
}

export class HealingService {
  /**
   * Record a healing event
   */
  async recordHealing(executionId: string, event: HealingEvent): Promise<void> {
    try {
      // Find or create healing pattern
      let pattern = await prisma.healingPattern.findFirst({
        where: {
          originalSelector: event.originalSelector,
          healedSelector: event.healedSelector,
        },
      });

      if (pattern) {
        // Update existing pattern
        await prisma.healingPattern.update({
          where: { id: pattern.id },
          data: {
            successCount: { increment: 1 },
            lastUsedAt: new Date(),
            // Update confidence with exponential moving average
            confidence: 0.7 * pattern.confidence + 0.3 * event.confidence,
          },
        });
      } else {
        // Create new pattern
        pattern = await prisma.healingPattern.create({
          data: {
            originalSelector: event.originalSelector,
            healedSelector: event.healedSelector,
            strategy: event.strategy,
            confidence: event.confidence,
            successCount: 1,
            lastUsedAt: new Date(),
          },
        });
      }

      // Record in execution metadata
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        select: { metadata: true },
      });

      const healingHistory = (execution?.metadata as any)?.healingHistory || [];
      healingHistory.push({
        ...event,
        timestamp: Date.now(),
        patternId: pattern.id,
      });

      await prisma.execution.update({
        where: { id: executionId },
        data: {
          metadata: {
            ...(execution?.metadata as any || {}),
            healingHistory,
            healingCount: healingHistory.length,
          },
        },
      });

      logger.info(`Healing recorded: ${event.originalSelector} -> ${event.healedSelector}`, {
        strategy: event.strategy,
        confidence: event.confidence,
      });
    } catch (error) {
      logger.error('Failed to record healing:', error);
    }
  }

  /**
   * Get the best healing suggestion for a selector
   */
  async suggestHealing(originalSelector: string): Promise<{
    selector: string;
    confidence: number;
    strategy: string;
  } | null> {
    const patterns = await prisma.healingPattern.findMany({
      where: { originalSelector },
      orderBy: [
        { confidence: 'desc' },
        { successCount: 'desc' },
      ],
      take: 1,
    });

    if (patterns.length === 0) {
      return null;
    }

    const best = patterns[0];
    return {
      selector: best.healedSelector,
      confidence: best.confidence,
      strategy: best.strategy,
    };
  }

  /**
   * Get healing statistics
   */
  async getStats(projectId?: string): Promise<HealingStats> {
    const patterns = await prisma.healingPattern.findMany({
      orderBy: { successCount: 'desc' },
    });

    const byStrategy: Record<string, number> = {};
    let totalConfidence = 0;

    for (const pattern of patterns) {
      byStrategy[pattern.strategy] = (byStrategy[pattern.strategy] || 0) + pattern.successCount;
      totalConfidence += pattern.confidence;
    }

    const topPatterns = patterns.slice(0, 10).map((p) => ({
      originalSelector: p.originalSelector,
      healedSelector: p.healedSelector,
      count: p.successCount,
    }));

    return {
      totalHealed: patterns.reduce((sum, p) => sum + p.successCount, 0),
      byStrategy,
      avgConfidence: patterns.length > 0 ? totalConfidence / patterns.length : 0,
      topPatterns,
    };
  }

  /**
   * Clean up old patterns with low success rates
   */
  async cleanupPatterns(minSuccessCount: number = 2, maxAge: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

    const result = await prisma.healingPattern.deleteMany({
      where: {
        OR: [
          {
            successCount: { lt: minSuccessCount },
            createdAt: { lt: cutoff },
          },
          {
            lastUsedAt: { lt: cutoff },
          },
        ],
      },
    });

    logger.info(`Cleaned up ${result.count} stale healing patterns`);
    return result.count;
  }

  /**
   * Train the healing model with DOM context
   * Stores training data for future ML model improvements
   */
  async trainModel(
    originalSelector: string,
    healedSelector: string,
    domContext: string
  ): Promise<void> {
    try {
      // Store training data in the healing pattern for ML analysis
      const features = this.extractFeatures(originalSelector, healedSelector, domContext);
      
      // Find or create a training record
      const existingPattern = await prisma.healingPattern.findFirst({
        where: {
          originalSelector,
          healedSelector,
        },
      });

      if (existingPattern) {
        // Update with new training data
        await prisma.healingPattern.update({
          where: { id: existingPattern.id },
          data: {
            successCount: { increment: 1 },
            lastUsedAt: new Date(),
            // Store extracted features for ML training
            pagePattern: features.pagePattern,
          },
        });
      } else {
        // Create new pattern with training features
        await prisma.healingPattern.create({
          data: {
            originalSelector,
            healedSelector,
            strategy: 'ML_TRAINED',
            confidence: 0.75,
            pagePattern: features.pagePattern,
          },
        });
      }

      // Log training data for offline ML pipeline
      logger.info('ML training data captured', {
        originalSelector,
        healedSelector,
        features,
        timestamp: Date.now(),
      });

      // If ML service is configured, send training data asynchronously
      const mlServiceUrl = process.env.ML_SERVICE_URL;
      if (mlServiceUrl) {
        this.sendToMLService(mlServiceUrl, {
          originalSelector,
          healedSelector,
          domContext: domContext.substring(0, 10000), // Limit context size
          features,
        }).catch((err) => {
          logger.warn('Failed to send training data to ML service:', err);
        });
      }
    } catch (error) {
      logger.error('Failed to capture training data:', error);
    }
  }

  /**
   * Extract features from selectors and DOM context for ML training
   */
  private extractFeatures(
    originalSelector: string,
    healedSelector: string,
    domContext: string
  ): {
    selectorType: string;
    transformationType: string;
    pagePattern: string;
    contextSignature: string;
  } {
    // Determine selector types
    const getSelectorType = (sel: string): string => {
      if (sel.startsWith('#')) return 'id';
      if (sel.startsWith('.')) return 'class';
      if (sel.includes('[data-testid')) return 'testid';
      if (sel.includes('[name=')) return 'name';
      if (sel.includes(':has-text')) return 'text';
      return 'complex';
    };

    const originalType = getSelectorType(originalSelector);
    const healedType = getSelectorType(healedSelector);

    // Determine transformation type
    const transformationType = `${originalType}_to_${healedType}`;

    // Extract page pattern from DOM context
    const titleMatch = domContext.match(/<title>([^<]+)<\/title>/i);
    const pagePattern = titleMatch ? titleMatch[1] : 'unknown';

    // Create a signature of the context for similarity matching
    const contextSignature = this.hashContext(domContext);

    return {
      selectorType: originalType,
      transformationType,
      pagePattern,
      contextSignature,
    };
  }

  /**
   * Create a simple hash of DOM context for similarity matching
   */
  private hashContext(domContext: string): string {
    // Extract key structural elements
    const tags = domContext.match(/<(\w+)/g) || [];
    const uniqueTags = [...new Set(tags.slice(0, 100))];
    return uniqueTags.join(',').substring(0, 200);
  }

  /**
   * Send training data to external ML service
   */
  private async sendToMLService(
    serviceUrl: string,
    data: {
      originalSelector: string;
      healedSelector: string;
      domContext: string;
      features: any;
    }
  ): Promise<void> {
    const response = await fetch(`${serviceUrl}/api/training/healing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ML_SERVICE_TOKEN || ''}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`ML service responded with ${response.status}`);
    }

    logger.debug('Training data sent to ML service');
  }
}
