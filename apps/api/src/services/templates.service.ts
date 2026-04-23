// VisionTest.ai — Story Templates (Phase 1b)
//
// Built-in starters the UI offers as one-click scaffolds. Seeded on first
// API boot into the Template table so usage counts survive restarts.
// Community templates are deferred (non-goal for this phase).

import { prisma } from '@visiontest/database';
import { logger } from '../utils/logger';

export interface BuiltinTemplate {
  slug: string;
  title: string;
  description: string;
  storyText: string;
  goalText?: string;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  // ---------------------------------------------------------------------
  // Phase 1b — core four (kept for stability; slugs are the API contract).
  // ---------------------------------------------------------------------
  {
    slug: 'email-password-login',
    title: 'Email + password login',
    description:
      'Navigate to a site, sign in with email + password, verify dashboard.',
    storyText: `Go to {{baseUrl}}
Type "{{email}}" in the email field
Type "{{password}}" in the password field
Click "Sign in"
Wait for the dashboard`,
    goalText: `The URL contains /dashboard.
"Welcome" is visible.`,
  },
  {
    slug: 'form-with-validation',
    title: 'Form with validation',
    description:
      'Submit a form with an invalid field, see validation error, fix it, submit again.',
    storyText: `Go to {{baseUrl}}
Click "Create"
Click "Submit"
Type "valid-value" in the name field
Click "Submit"`,
    goalText: `"Please enter" is NOT visible.
"Created" is visible.`,
  },
  {
    slug: 'paginated-table',
    title: 'Paginated table',
    description:
      'Open a list view, sort by a column, page forward, verify row count.',
    storyText: `Go to {{baseUrl}}
Click the "Name" column header
Click the "Next" button
Take a screenshot`,
    goalText: `10 rows are visible.
The URL contains page=2.`,
  },
  {
    slug: 'code-viewer-go-to-line',
    title: 'Code viewer: file → line → copy ref → symbols',
    description:
      'Open a code-viewer app, sign in, open a file, jump to line 42, copy the line reference, open the symbols panel, click the first symbol.',
    storyText: `Go to {{baseUrl}}/login
Type "{{password}}" in the password field
Click "Sign In"
Click the first repository in the list
Click the first file in the files list
Click "Go to line"
Type "42" in the line field
Press Enter
Click "Copy ref"
Click "Symbols"
Click the first symbol`,
    goalText: `The URL contains #L42.
"Reference copied" is visible.`,
  },

  // ---------------------------------------------------------------------
  // Phase 5 — deep-interaction, framework-specific opinionated starters.
  // Each is a working journey a user can run with minimal edits.
  // ---------------------------------------------------------------------
  {
    slug: 'react-router-link-nav',
    title: 'React Router — link → navigate → back',
    description:
      'Exercise client-side routing: click a link, verify the new route, use the browser back button, verify return.',
    storyText: `Go to {{baseUrl}}
Click the "About" link
Click the "Contact" link
Click the "Home" link`,
    goalText: `The URL ends with /.
"Home" is visible.`,
  },
  {
    slug: 'nextjs-form-submit',
    title: 'Next.js — server-action form submit',
    description:
      'Fill out a form, submit via a server action, verify redirect + success state.',
    storyText: `Go to {{baseUrl}}/new
Type "Demo title" in the title field
Type "Long description body" in the description field
Click "Create"
Wait for the detail page`,
    goalText: `The URL contains /items/.
"Demo title" is visible.
"Created successfully" is visible.`,
  },
  {
    slug: 'shopify-admin-cart',
    title: 'Shopify-style admin — cart flow',
    description:
      'Add a product, view cart, adjust quantity, proceed to checkout (stubbed).',
    storyText: `Go to {{baseUrl}}
Click "Add to cart"
Click the "Cart" link
Click the "+" button
Click "Checkout"`,
    goalText: `The URL contains /checkout.
"Quantity: 2" is visible.`,
  },
  {
    slug: 'dashboard-empty-state',
    title: 'Empty state → create first resource',
    description:
      'Land on an empty dashboard, follow the empty-state CTA to create a resource, verify the dashboard now populates.',
    storyText: `Go to {{baseUrl}}/dashboard
Click "Create your first project"
Type "First Project" in the name field
Click "Save"`,
    goalText: `"First Project" is visible.
"Create your first project" is NOT visible.`,
  },
  {
    slug: 'search-then-open-result',
    title: 'Search → open result → verify content',
    description:
      'Type a query in the global search, press Enter, click the first result, verify detail content.',
    storyText: `Go to {{baseUrl}}
Click the "Search" button
Type "welcome" in the search field
Press Enter
Click the first result`,
    goalText: `"welcome" is visible.
The URL contains /search?q=welcome OR /docs/welcome.`,
  },
  {
    slug: 'dark-mode-toggle',
    title: 'Dark mode toggle',
    description:
      'Flip the theme toggle, verify the body class changed, refresh, verify persistence.',
    storyText: `Go to {{baseUrl}}
Click the "Dark mode" button
Take a screenshot`,
    goalText: `"Dark mode" is NOT visible.
"Light mode" is visible.`,
  },
  {
    slug: 'modal-open-close-esc',
    title: 'Modal — open, fill, close with Escape',
    description:
      'Open a modal dialog, type into a field, dismiss with Escape, verify the modal disappeared.',
    storyText: `Go to {{baseUrl}}
Click "New item"
Type "Draft" in the name field
Press Escape`,
    goalText: `"New item" is visible.
"Draft" is NOT visible.`,
  },
];

/**
 * Seed the Template table with built-in starters on boot. Idempotent — a
 * second run updates title/description/storyText/goalText in place so
 * improvements to the starter content ship with the next restart, but
 * usageCount is preserved.
 */
export async function seedBuiltinTemplates(): Promise<void> {
  for (const t of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { slug: t.slug },
      update: {
        title: t.title,
        description: t.description,
        storyText: t.storyText,
        goalText: t.goalText ?? null,
      },
      create: {
        slug: t.slug,
        title: t.title,
        description: t.description,
        storyText: t.storyText,
        goalText: t.goalText ?? null,
        source: 'builtin',
      },
    });
  }
  logger.info(`Seeded ${BUILTIN_TEMPLATES.length} built-in story templates`);
}

export async function listTemplates(): Promise<
  Array<{
    slug: string;
    title: string;
    description: string;
    storyText: string;
    goalText: string | null;
    source: string;
    usageCount: number;
  }>
> {
  const rows = await prisma.template.findMany({
    orderBy: [{ source: 'asc' }, { title: 'asc' }],
  });
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    storyText: r.storyText,
    goalText: r.goalText,
    source: r.source,
    usageCount: r.usageCount,
  }));
}

/**
 * Bump usage count when a user picks a template — surfaced later in
 * community ranking and "most used" sort orders.
 */
export async function incrementUsage(slug: string): Promise<void> {
  await prisma.template.update({
    where: { slug },
    data: { usageCount: { increment: 1 } },
  });
}

export default {
  BUILTIN_TEMPLATES,
  seedBuiltinTemplates,
  listTemplates,
  incrementUsage,
};
