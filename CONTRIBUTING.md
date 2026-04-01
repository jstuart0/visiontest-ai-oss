# Contributing to VisionTest AI

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- **Node.js** 20+
- **Docker** and Docker Compose
- **npm** 10+
- **Git**

## Development Setup

```bash
# Clone the repository
git clone https://github.com/visiontest-ai/visiontest-ai.git
cd visiontest-ai

# Run the automated setup
./scripts/setup.sh

# Start development servers
npm run dev
```

This starts PostgreSQL, Redis, and MinIO via Docker Compose, runs migrations, seeds sample data, and launches all three apps (web, api, worker).

## Project Structure

```
apps/
  api/          Express + Socket.IO API server
  web/          Next.js 14 frontend (App Router)
  worker/       BullMQ worker with Playwright
packages/
  database/     Prisma schema and migrations
  types/        Shared TypeScript types
```

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run tests: `npm test`
4. Type check: `npx tsc --noEmit --project apps/api/tsconfig.json`
5. Commit with conventional commits: `feat: add new feature`
6. Push and create a pull request

## Code Style

- **TypeScript** throughout -- no plain JavaScript
- **Zod** for request validation in API routes
- **React Query** (TanStack Query) for data fetching in frontend
- **Zustand** for client state management
- **shadcn/ui** components with Tailwind CSS
- Conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

## API Routes

When adding new routes:

- Register literal paths **before** parameterized paths (Express matches in order)
- Add Zod validation schemas for all request bodies
- Use the `authenticate` middleware for protected routes
- Return standardized responses: `{ success: true, data: {...} }`
- Handle errors via `next(error)` -- the error middleware catches them

```typescript
// Good: literal before parameterized
router.get('/stats', authenticate, ...);
router.get('/:id', authenticate, ...);

// Bad: parameterized catches literal
router.get('/:id', authenticate, ...);
router.get('/stats', authenticate, ...); // unreachable!
```

## Frontend Pages

When adding new pages:

- Create in `apps/web/src/app/(dashboard)/your-feature/page.tsx`
- Use React Query for data fetching
- Add the page to `Sidebar.tsx` navigation
- Handle loading, empty, and error states
- Use shadcn/ui components from `@/components/ui/`

## Database Changes

```bash
# Edit the schema
vim packages/database/prisma/schema.prisma

# Create a migration
npx prisma migrate dev --name your_migration_name --schema=packages/database/prisma/schema.prisma

# Generate client
npm run db:generate
```

## Testing

```bash
# Run all tests
npm test

# Run API tests only
npm run test --workspace=@visiontest/api

# Run worker tests only
npm run test --workspace=@visiontest/worker

# Run with coverage
npm run test:coverage
```

Maintain 95%+ test coverage on core services. Write tests for new service methods.

## Pull Request Guidelines

- Keep PRs focused -- one feature or fix per PR
- Include a clear description of what changed and why
- Ensure CI passes (lint, typecheck, tests, Docker build)
- Add tests for new functionality
- Update documentation if behavior changes

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
