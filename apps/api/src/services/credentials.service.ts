// VisionTest.ai — Credentials service (Phase 1c)
//
// Strict environment-isolation resolution with author-opt-in fallback.
// See schema.prisma `Credential` model block for the full contract.
//
// Tests reference credentials by `key` (e.g. `{{creds.admin}}`). Values
// are stored AES-256-GCM-encrypted and ONLY decrypted at runtime — the
// API never exposes the plaintext in responses.

import { prisma, encrypt, decrypt } from '@visiontest/database';
import { BadRequestError, NotFoundError } from '../middleware/error';

export interface CredentialBlob {
  [field: string]: string; // e.g. { email, password } — opaque to VT
}

export interface CreateCredentialInput {
  orgId: string;
  projectId?: string;
  key: string;
  environment?: string;
  blob: CredentialBlob;
  allowEnvironmentFallback?: boolean;
}

export interface UpdateCredentialInput {
  blob?: CredentialBlob;
  allowEnvironmentFallback?: boolean;
}

/**
 * Create a new credential row. (orgId, projectId, key, environment) is
 * unique — duplicates throw a clear error rather than overwriting.
 */
export async function createCredential(input: CreateCredentialInput) {
  const existing = await prisma.credential.findFirst({
    where: {
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      key: input.key,
      environment: input.environment ?? null,
    },
  });
  if (existing) {
    throw BadRequestError(
      `Credential (key="${input.key}", environment="${
        input.environment ?? 'default'
      }") already exists in this scope. Use rotate() to update it.`,
    );
  }
  const created = await prisma.credential.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      key: input.key,
      environment: input.environment ?? null,
      encryptedBlob: encrypt(JSON.stringify(input.blob)),
      allowEnvironmentFallback: input.allowEnvironmentFallback ?? false,
      version: 1,
    },
  });
  return redact(created);
}

/**
 * Rotate the underlying encrypted blob in place. Increments version.
 * Key, scope, environment are immutable for the row's lifetime.
 */
export async function rotateCredential(
  id: string,
  input: UpdateCredentialInput,
) {
  const existing = await prisma.credential.findUnique({ where: { id } });
  if (!existing) throw NotFoundError('Credential');

  const updated = await prisma.credential.update({
    where: { id },
    data: {
      encryptedBlob: input.blob
        ? encrypt(JSON.stringify(input.blob))
        : undefined,
      allowEnvironmentFallback:
        input.allowEnvironmentFallback ?? existing.allowEnvironmentFallback,
      version: input.blob ? existing.version + 1 : existing.version,
    },
  });
  return redact(updated);
}

/**
 * Delete a credential row. Fails if any Test.credentialRef still points at
 * this key — the UI surfaces the blocking tests so the user can repoint.
 */
export async function deleteCredential(id: string) {
  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) throw NotFoundError('Credential');

  const refs = await prisma.test.findMany({
    where: {
      credentialRef: cred.key,
      projectId: cred.projectId ?? undefined,
    },
    select: { id: true, name: true },
    take: 50,
  });
  if (refs.length > 0) {
    throw BadRequestError(
      `Cannot delete credential "${cred.key}": ${refs.length} test(s) reference it. Repoint or delete those tests first.`,
    );
  }
  await prisma.credential.delete({ where: { id } });
}

export async function listCredentials(opts: {
  orgId: string;
  projectId?: string;
}) {
  const rows = await prisma.credential.findMany({
    where: {
      orgId: opts.orgId,
      OR: [{ projectId: opts.projectId ?? null }, { projectId: null }],
    },
    orderBy: [{ key: 'asc' }, { environment: 'asc' }],
  });
  return rows.map(redact);
}

/**
 * Resolve a credentialRef + environment pair at runtime. Strict: when
 * Test.environment is set, only env-matching rows are eligible UNLESS a
 * null-environment row has allowEnvironmentFallback=true.
 *
 * Returns the decrypted blob or throws with a clear "no match" error.
 * The error mentions (scope, key, environment) so the user can fix it.
 */
export async function resolveCredential(opts: {
  orgId: string;
  projectId: string;
  key: string;
  environment: string | null;
}): Promise<{
  blob: CredentialBlob;
  matchedRowId: string;
  matchedScope: 'project' | 'org';
  matchedFallback: boolean;
  version: number;
}> {
  // Strict precedence first — exact env match, project then org.
  const strictRows = await prisma.credential.findMany({
    where: {
      orgId: opts.orgId,
      key: opts.key,
      environment: opts.environment,
      OR: [{ projectId: opts.projectId }, { projectId: null }],
    },
  });
  const project = strictRows.find((r) => r.projectId === opts.projectId);
  if (project) {
    return {
      blob: JSON.parse(decrypt(project.encryptedBlob)),
      matchedRowId: project.id,
      matchedScope: 'project',
      matchedFallback: false,
      version: project.version,
    };
  }
  const org = strictRows.find((r) => r.projectId === null);
  if (org) {
    return {
      blob: JSON.parse(decrypt(org.encryptedBlob)),
      matchedRowId: org.id,
      matchedScope: 'org',
      matchedFallback: false,
      version: org.version,
    };
  }

  // Fallback path — only triggers when Test.environment is set and the
  // null-env row has allowEnvironmentFallback=true.
  if (opts.environment !== null) {
    const fallbackRows = await prisma.credential.findMany({
      where: {
        orgId: opts.orgId,
        key: opts.key,
        environment: null,
        allowEnvironmentFallback: true,
        OR: [{ projectId: opts.projectId }, { projectId: null }],
      },
    });
    const fp = fallbackRows.find((r) => r.projectId === opts.projectId);
    if (fp) {
      return {
        blob: JSON.parse(decrypt(fp.encryptedBlob)),
        matchedRowId: fp.id,
        matchedScope: 'project',
        matchedFallback: true,
        version: fp.version,
      };
    }
    const fo = fallbackRows.find((r) => r.projectId === null);
    if (fo) {
      return {
        blob: JSON.parse(decrypt(fo.encryptedBlob)),
        matchedRowId: fo.id,
        matchedScope: 'org',
        matchedFallback: true,
        version: fo.version,
      };
    }
  }

  throw BadRequestError(
    `No credential "${opts.key}" found for environment="${
      opts.environment ?? 'default'
    }" in project/org scope. Create one, or enable allowEnvironmentFallback on the default-env row.`,
  );
}

/**
 * Never return encryptedBlob in API responses. UI only needs metadata.
 */
function redact<T extends { encryptedBlob: string }>(
  row: T,
): Omit<T, 'encryptedBlob'> & { encryptedBlob: undefined } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedBlob, ...rest } = row;
  return { ...rest, encryptedBlob: undefined };
}

export default {
  createCredential,
  rotateCredential,
  deleteCredential,
  listCredentials,
  resolveCredential,
};
