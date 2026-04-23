// GoalEvalCard — renders Execution.goalAchieved/reasoning/checks
// Deterministic layer-1 checks render as pass/fail pills. If the run
// used an LLM, the reasoning string is shown in a collapsed drawer
// ("Why did this pass?") so it's not scary for new users.

'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Target,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GoalCheck {
  kind: string;
  selector?: string;
  value?: string;
  urlOp?: string;
  source: string;
  passed: boolean;
  error?: string;
  actual?: string;
}

interface GoalEvalCardProps {
  achieved: boolean | null | undefined;
  reasoning?: string | null;
  checks?: GoalCheck[] | null;
  goal?: string | null;
}

export function GoalEvalCard({
  achieved,
  reasoning,
  checks,
  goal,
}: GoalEvalCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (achieved === null || achieved === undefined) {
    return null;
  }

  const checksList = checks || [];

  return (
    <Card
      className={
        achieved
          ? 'bg-card border-emerald-900/40'
          : 'bg-card border-red-900/40'
      }
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-5 h-5" />
          Goal evaluation
          {achieved ? (
            <Badge
              variant="outline"
              className="bg-emerald-900/30 text-emerald-300 border-emerald-700/50 ml-2"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> achieved
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-red-900/30 text-red-300 border-red-700/50 ml-2"
            >
              <XCircle className="w-3 h-3 mr-1" /> NOT achieved
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {goal && (
          <div className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
            "{goal}"
          </div>
        )}

        {checksList.length > 0 && (
          <div className="space-y-1.5">
            {checksList.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                {c.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground uppercase">
                    {c.kind}
                  </span>
                  <span className="ml-2 text-foreground">
                    {c.source}
                  </span>
                  {!c.passed && c.error && (
                    <div className="text-xs text-red-300 mt-0.5">
                      {c.error}
                      {c.actual && (
                        <span className="italic"> (actual: {c.actual})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {reasoning && (
          <div>
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showReasoning ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <HelpCircle className="w-3 h-3" />
              Why did this {achieved ? 'pass' : 'fail'}?
            </button>
            {showReasoning && (
              <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/40 rounded p-2">
                {reasoning}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GoalEvalCard;
