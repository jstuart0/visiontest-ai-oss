'use client';

// /runs/:id — shareable alias for /executions/:id.
// Kept as its own route so post-mortem links dropped in Slack stay
// working if we ever rename the underlying page.

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RunAliasPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/executions/${params.id}`);
  }, [params.id, router]);

  return (
    <div className="text-sm text-muted-foreground p-8">
      Redirecting to execution view…
    </div>
  );
}
