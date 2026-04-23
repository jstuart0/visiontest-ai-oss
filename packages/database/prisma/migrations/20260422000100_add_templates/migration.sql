-- Phase 1b: Story templates

CREATE TABLE "Template" (
  "id"          TEXT PRIMARY KEY,
  "slug"        TEXT NOT NULL UNIQUE,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "storyText"   TEXT NOT NULL,
  "goalText"    TEXT,
  "source"      TEXT NOT NULL DEFAULT 'builtin',
  "authorId"    TEXT,
  "usageCount"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Template_source_idx" ON "Template"("source");
