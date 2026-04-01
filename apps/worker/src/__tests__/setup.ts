/**
 * VisionTest.ai - Worker Test Setup
 * Hospital-Grade Test Infrastructure
 * 
 * Comprehensive mocks for all external dependencies:
 * - Prisma database
 * - MinIO/S3 storage
 * - Redis/BullMQ
 * - Playwright browser
 */

import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import { Readable } from 'stream';

// =============================================================================
// PRISMA MOCK
// =============================================================================

export const mockPrismaClient = {
  // HealingPattern methods
  healingPattern: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  // Screenshot methods
  screenshot: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  // Baseline methods
  baseline: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  // Comparison methods
  comparison: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  // IgnoreMask methods
  ignoreMask: {
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  // Checkpoint methods
  checkpoint: {
    create: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  // Execution methods
  execution: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  // Test methods
  test: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  // FlakyTest methods
  flakyTest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  // Connection method
  $disconnect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@visiontest/database', () => ({
  prisma: mockPrismaClient,
  ExecutionStatus: {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    PASSED: 'PASSED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
}));

// =============================================================================
// MINIO MOCK
// =============================================================================

export const mockMinioStream = () => {
  const stream = new Readable({
    read() {},
  });
  return stream;
};

export const mockMinioClient = {
  bucketExists: vi.fn().mockResolvedValue(true),
  makeBucket: vi.fn().mockResolvedValue(undefined),
  putObject: vi.fn().mockResolvedValue({ etag: 'mock-etag', versionId: null }),
  getObject: vi.fn().mockImplementation(() => {
    const stream = mockMinioStream();
    setTimeout(() => {
      stream.push(Buffer.from(JSON.stringify({ url: 'http://example.com', cookies: [], localStorage: {}, sessionStorage: {} })));
      stream.push(null);
    }, 0);
    return Promise.resolve(stream);
  }),
  removeObject: vi.fn().mockResolvedValue(undefined),
  presignedGetObject: vi.fn().mockResolvedValue('https://minio.example.com/presigned-url'),
};

vi.mock('minio', () => ({
  Client: vi.fn().mockImplementation(() => mockMinioClient),
}));

// =============================================================================
// REDIS/BULLMQ MOCK
// =============================================================================

export const mockRedisClient = {
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  subscribe: vi.fn(),
  publish: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedisClient),
}));

export const mockWorker = {
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
};

export const mockJob = {
  id: 'mock-job-id',
  data: {},
  updateProgress: vi.fn(),
};

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => mockWorker),
  Job: vi.fn(),
}));

// =============================================================================
// PLAYWRIGHT MOCK
// =============================================================================

export const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  click: vi.fn().mockResolvedValue(undefined),
  fill: vi.fn().mockResolvedValue(undefined),
  selectOption: vi.fn().mockResolvedValue(undefined),
  hover: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
  waitForSelector: vi.fn().mockResolvedValue(undefined),
  locator: vi.fn().mockReturnValue({
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    toBeVisible: vi.fn().mockResolvedValue(undefined),
    toBeHidden: vi.fn().mockResolvedValue(undefined),
    toHaveText: vi.fn().mockResolvedValue(undefined),
    toHaveValue: vi.fn().mockResolvedValue(undefined),
    toHaveCount: vi.fn().mockResolvedValue(undefined),
    toBeEnabled: vi.fn().mockResolvedValue(undefined),
    toBeDisabled: vi.fn().mockResolvedValue(undefined),
  }),
  evaluate: vi.fn().mockResolvedValue({
    localStorage: {},
    sessionStorage: {},
  }),
  url: vi.fn().mockReturnValue('http://example.com'),
  context: vi.fn().mockReturnValue({
    cookies: vi.fn().mockResolvedValue([]),
  }),
  close: vi.fn().mockResolvedValue(undefined),
};

export const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  cookies: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined),
  browser: vi.fn().mockReturnValue({
    isConnected: vi.fn().mockReturnValue(true),
  }),
};

export const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
};

export const mockPlaywright = {
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  firefox: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  webkit: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
  devices: {
    'iPhone 15': { viewport: { width: 393, height: 852 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    'iPhone 15 Pro': { viewport: { width: 393, height: 852 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    'Pixel 8': { viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
    'Galaxy S24': { viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Samsung SM-S921B)', deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  },
};

vi.mock('playwright', () => mockPlaywright);

// Mock expect from @playwright/test for assertions
const mockExpect = vi.fn().mockImplementation(() => ({
  toBeVisible: vi.fn().mockResolvedValue(undefined),
  toBeHidden: vi.fn().mockResolvedValue(undefined),
  toHaveText: vi.fn().mockResolvedValue(undefined),
  toHaveValue: vi.fn().mockResolvedValue(undefined),
  toHaveCount: vi.fn().mockResolvedValue(undefined),
  toBeEnabled: vi.fn().mockResolvedValue(undefined),
  toBeDisabled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@playwright/test', () => ({
  expect: mockExpect,
}));

// =============================================================================
// JIMP MOCK
// =============================================================================

export const mockJimpImage = {
  resize: vi.fn().mockReturnThis(),
  getBufferAsync: vi.fn().mockResolvedValue(Buffer.alloc(100)),
  bitmap: { width: 100, height: 100, data: Buffer.alloc(40000) },
};

vi.mock('jimp', () => ({
  default: {
    read: vi.fn().mockResolvedValue(mockJimpImage),
    MIME_PNG: 'image/png',
  },
}));

// =============================================================================
// PIXELMATCH MOCK
// =============================================================================

vi.mock('pixelmatch', () => ({
  default: vi.fn().mockReturnValue(0), // No diff by default
}));

// =============================================================================
// PNGJS MOCK
// =============================================================================

export const createMockPNG = (width = 100, height = 100) => ({
  width,
  height,
  data: Buffer.alloc(width * height * 4, 128), // RGBA data
});

vi.mock('pngjs', () => ({
  PNG: class MockPNG {
    width: number;
    height: number;
    data: Buffer;
    
    constructor(options?: { width?: number; height?: number }) {
      this.width = options?.width || 100;
      this.height = options?.height || 100;
      this.data = Buffer.alloc(this.width * this.height * 4, 128);
    }
    
    static sync = {
      read: vi.fn().mockImplementation(() => createMockPNG()),
      write: vi.fn().mockReturnValue(Buffer.from('mock-png-data')),
    };
  },
}));

// =============================================================================
// LOGGER MOCK
// =============================================================================

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// =============================================================================
// UUID MOCK
// =============================================================================

let uuidCounter = 0;

vi.mock('uuid', () => ({
  v4: vi.fn().mockImplementation(() => `mock-uuid-${++uuidCounter}`),
}));

// =============================================================================
// TEST LIFECYCLE HOOKS
// =============================================================================

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  uuidCounter = 0;
});

afterEach(() => {
  // Clean up any pending timers
  vi.useRealTimers();
});

afterAll(() => {
  // Restore all mocks after all tests
  vi.restoreAllMocks();
});

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a mock PNG buffer with specified dimensions
 */
export function createMockPNGBuffer(width = 100, height = 100): Buffer {
  // Simplified PNG structure for testing
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // Bit depth
  ihdr[17] = 6; // Color type (RGBA)
  
  return Buffer.concat([header, ihdr, Buffer.alloc(100)]);
}

/**
 * Create a mock test object
 */
export function createMockTest(overrides = {}) {
  return {
    id: 'test-123',
    name: 'Test Case',
    projectId: 'project-123',
    suiteId: 'suite-123',
    steps: JSON.stringify([
      { type: 'navigate', url: 'http://example.com' },
      { type: 'click', selector: '#button' },
      { type: 'type', selector: '#input', value: 'test' },
    ]),
    status: 'ACTIVE',
    ...overrides,
  };
}

/**
 * Create a mock execution object
 */
export function createMockExecution(overrides = {}) {
  return {
    id: 'exec-123',
    testId: 'test-123',
    projectId: 'project-123',
    status: 'PENDING',
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a mock healing pattern
 */
export function createMockHealingPattern(overrides = {}) {
  return {
    id: 'pattern-123',
    originalSelector: '#old-button',
    healedSelector: '[data-testid="button"]',
    strategy: 'DOM_ANALYSIS',
    confidence: 0.85,
    successCount: 5,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock checkpoint
 */
export function createMockCheckpoint(overrides = {}) {
  return {
    id: 'checkpoint-123',
    executionId: 'exec-123',
    stepNumber: 5,
    state: {
      url: 'http://example.com/page',
      cookies: [{ name: 'session', value: 'abc123' }],
      localStorage: { key: 'value' },
      sessionStorage: {},
    },
    storageKey: 'exec-123/5-mock-uuid.json',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock baseline
 */
export function createMockBaseline(overrides = {}) {
  return {
    id: 'baseline-123',
    projectId: 'project-123',
    name: 'Homepage Baseline',
    screenshots: JSON.stringify([
      { name: 'homepage', url: 'http://minio:9000/screenshots/baseline.png' },
    ]),
    status: 'APPROVED',
    ...overrides,
  };
}

/**
 * Wait for all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Create a delayed promise for testing async behavior
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
