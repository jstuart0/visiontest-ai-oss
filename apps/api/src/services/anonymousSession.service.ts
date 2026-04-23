// VisionTest.ai — Anonymous Sandbox (Phase 4)
//
// Provision a synthetic User + Org + Project backed by real DB rows so
// the "try it in 60 seconds" flow can run against real infrastructure.
// Identity is the anonSessionCookie UUID; the durable-but-lifespan-limited
// lifecycle is enforced by `expiresAt` + the nightly cleanup job.
//
// See plan §6 Sandbox lifecycle for the full contract.

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma, TestStatus } from '@visiontest/database';
import { generateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

export interface AnonymousSession {
  userId: string;
  anonSessionCookie: string;
  orgId: string;
  projectId: string;
  accessToken: string;
  expiresAt: Date;
}

const ANON_EMAIL_SUFFIX = '@anon.visiontest.local';
const DEFAULT_TTL_HOURS = 24;

export function anonymousSessionsEnabled(): boolean {
  const raw = process.env.ALLOW_ANONYMOUS_SESSIONS;
  if (raw === undefined || raw === '') {
    // Default policy per plan §6: enabled in development, disabled elsewhere.
    return process.env.NODE_ENV === 'development';
  }
  return raw === 'true' || raw === '1';
}

/**
 * Create a new anonymous session — a fresh User+Org+Project triple, a
 * signed access token, and the cookie UUID to set.
 *
 * The User row has synthetic email/password so the unique+required
 * columns hold without special-casing auth middleware.
 */
export async function createAnonymousSession(
  ttlHours: number = DEFAULT_TTL_HOURS,
): Promise<AnonymousSession> {
  const anonCookie = crypto.randomUUID();
  const email = `anon_${crypto.randomBytes(8).toString('hex')}${ANON_EMAIL_SUFFIX}`;
  const password = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      name: 'Anonymous explorer',
      isAnonymous: true,
      expiresAt,
      anonSessionCookie: anonCookie,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'Sandbox',
      slug: `sandbox-${user.id.slice(-8)}`,
      users: { create: { userId: user.id, role: 'OWNER' } },
    },
  });

  const project = await prisma.project.create({
    data: {
      name: 'Sandbox Project',
      slug: `sandbox-${user.id.slice(-8)}`,
      orgId: org.id,
    },
  });

  const accessToken = generateToken(user.id, email, 'access');

  logger.info(`Anonymous session created: ${user.id}`, {
    anonCookie,
    expiresAt,
  });

  return {
    userId: user.id,
    anonSessionCookie: anonCookie,
    orgId: org.id,
    projectId: project.id,
    accessToken,
    expiresAt,
  };
}

/**
 * Find an existing anonymous session by the cookie UUID, extend its TTL
 * (sliding window up to 7 days total age), or return null if expired.
 */
export async function touchAnonymousSession(
  anonCookie: string,
  ttlHours: number = DEFAULT_TTL_HOURS,
): Promise<{
  userId: string;
  orgId: string;
  projectId: string;
  expiresAt: Date;
} | null> {
  const user = await prisma.user.findUnique({
    where: { anonSessionCookie: anonCookie },
    include: { organizations: { include: { org: { include: { projects: true } } } } },
  });
  if (!user || !user.isAnonymous) return null;
  if (user.expiresAt && user.expiresAt < new Date()) return null;

  // Hard ceiling of 7 days from creation — no matter how many touches,
  // we won't extend past this. Prevents "tab left open forever" sessions.
  const maxExpires = new Date(
    user.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000,
  );
  const nextExpires = new Date(
    Math.min(
      Date.now() + ttlHours * 60 * 60 * 1000,
      maxExpires.getTime(),
    ),
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { expiresAt: nextExpires },
  });

  const org = user.organizations[0]?.org;
  const project = org?.projects[0];
  if (!org || !project) return null;

  return {
    userId: user.id,
    orgId: org.id,
    projectId: project.id,
    expiresAt: nextExpires,
  };
}

/**
 * Atomic sign-up migration: swap synthetic email/password for real ones
 * in a single transaction. Cookie UUID stays the same so the user's
 * current work is seamlessly available after the flip.
 *
 * Failure semantics: any error reverts the full tx — sandbox is left
 * untouched and the user can retry.
 */
export async function upgradeAnonymousSession(opts: {
  anonSessionCookie: string;
  email: string;
  passwordHash: string;
  name?: string;
  orgName?: string;
}): Promise<{ userId: string }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { anonSessionCookie: opts.anonSessionCookie },
    });
    if (!user || !user.isAnonymous) {
      throw new Error('No anonymous session to upgrade');
    }
    if (user.expiresAt && user.expiresAt < new Date()) {
      throw new Error('Anonymous session already expired');
    }

    const existing = await tx.user.findUnique({ where: { email: opts.email } });
    if (existing) {
      throw new Error(`Email ${opts.email} already registered`);
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        email: opts.email,
        passwordHash: opts.passwordHash,
        name: opts.name ?? user.name,
        isAnonymous: false,
        expiresAt: null,
        anonSessionCookie: null,
      },
    });

    if (opts.orgName) {
      const org = await tx.organizationUser.findFirst({
        where: { userId: user.id, role: 'OWNER' },
      });
      if (org) {
        await tx.organization.update({
          where: { id: org.orgId },
          data: { name: opts.orgName },
        });
      }
    }

    return { userId: user.id };
  });
}

/**
 * Reap expired anonymous sessions. Cascade deletes organization +
 * projects + tests + executions + screenshots via FK onDelete: Cascade.
 * Safe to invoke on an interval; idempotent.
 */
export async function reapExpiredAnonymousSessions(): Promise<number> {
  const now = new Date();
  const { count } = await prisma.user.deleteMany({
    where: {
      isAnonymous: true,
      expiresAt: { lt: now },
    },
  });
  if (count > 0) {
    logger.info(`Reaped ${count} expired anonymous session(s)`);
  }
  return count;
}

export default {
  anonymousSessionsEnabled,
  createAnonymousSession,
  touchAnonymousSession,
  upgradeAnonymousSession,
  reapExpiredAnonymousSessions,
};
