import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-md px-4">
        <FileQuestion className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground text-sm">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard">
          <Button size="sm">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
