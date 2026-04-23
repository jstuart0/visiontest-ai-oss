-- Phase 4: Anonymous sandbox fields on User

ALTER TABLE "User"
  ADD COLUMN "isAnonymous"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "expiresAt"         TIMESTAMP(3),
  ADD COLUMN "anonSessionCookie" TEXT;

CREATE UNIQUE INDEX "User_anonSessionCookie_key" ON "User"("anonSessionCookie");
CREATE INDEX "User_isAnonymous_expiresAt_idx" ON "User"("isAnonymous", "expiresAt");
