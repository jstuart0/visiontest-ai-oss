-- Phase 2: ExploreNode — canonical crawl-graph representation for EXPLORE executions

CREATE TABLE "ExploreNode" (
  "id"                  TEXT PRIMARY KEY,
  "executionId"         TEXT NOT NULL,
  "url"                 TEXT NOT NULL,
  "parentId"            TEXT,
  "orderIndex"          INTEGER NOT NULL,
  "interactionKind"     TEXT NOT NULL,
  "interactionLabel"    TEXT NOT NULL,
  "interactionSelector" TEXT,
  "status"              TEXT NOT NULL,
  "skipReason"          TEXT,
  "errorText"           TEXT,
  "httpStatus"          INTEGER,
  "screenshotPre"       TEXT,
  "screenshotPost"      TEXT,
  "consoleErrors"       JSONB,
  "durationMs"          INTEGER,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExploreNode_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExploreNode_parentId_fkey"    FOREIGN KEY ("parentId")    REFERENCES "ExploreNode"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExploreNode_executionId_idx" ON "ExploreNode"("executionId");
CREATE INDEX "ExploreNode_executionId_parentId_orderIndex_idx"
  ON "ExploreNode"("executionId", "parentId", "orderIndex");
