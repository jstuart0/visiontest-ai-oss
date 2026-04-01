import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/test/integration/**', // Integration tests need a test database
      'node_modules',
      'dist',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        'src/test/**',
      ],
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});
