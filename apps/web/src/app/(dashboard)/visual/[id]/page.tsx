'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  X,
  Layers,
  SplitSquareHorizontal,
  Image,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentProject } from '@/hooks/useProject';
import { api, visualApi, getApiBaseUrl, type VisualComparison } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function screenshotProxyUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith('/api/') || rawUrl.startsWith('http')) return rawUrl;
  return `${getApiBaseUrl()}/screenshots/${rawUrl}`;
}

type ViewMode = 'side-by-side' | 'overlay' | 'diff';

export default function VisualDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: comparisonId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { project } = useCurrentProject();

  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [zoom, setZoom] = useState(100);

  const { data: comparison, isLoading } = useQuery({
    queryKey: ['visual', project?.id, comparisonId],
    queryFn: () => visualApi.get(project!.id, comparisonId),
    enabled: !!project?.id,
  });

  // Fetch comparison list for prev/next navigation
  const { data: allComparisons } = useQuery({
    queryKey: ['visual', project?.id],
    queryFn: () => visualApi.list(project!.id),
    enabled: !!project?.id,
  });

  const comparisonIndex = allComparisons?.findIndex((c: any) => c.id === comparisonId) ?? -1;
  const prevComparison = comparisonIndex > 0 ? allComparisons?.[comparisonIndex - 1] : null;
  const nextComparison = allComparisons && comparisonIndex < allComparisons.length - 1 ? allComparisons[comparisonIndex + 1] : null;

  // Keyboard shortcuts: Left/Right for navigation, A for approve, R for reject
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && prevComparison) router.push(`/visual/${prevComparison.id}`);
      if (e.key === 'ArrowRight' && nextComparison) router.push(`/visual/${nextComparison.id}`);
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) approveMutation.mutate();
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) rejectMutation.mutate();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevComparison, nextComparison, router, approveMutation, rejectMutation]);

  const approveMutation = useMutation({
    // Pass updateBaseline so the baseline image actually moves to match
    // the approved screenshot — otherwise the toast lies and a repeat
    // of the same test would flag the same "diff" again.
    mutationFn: () =>
      visualApi.approve(project!.id, comparisonId, { updateBaseline: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['visual', project?.id, comparisonId],
      });
      queryClient.invalidateQueries({ queryKey: ['visual', project?.id] });
      toast.success('Changes approved — baseline updated');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to approve changes');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => visualApi.reject(project!.id, comparisonId, 'Rejected via UI'),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['visual', project?.id, comparisonId],
      });
      queryClient.invalidateQueries({ queryKey: ['visual', project?.id] });
      toast.success('Changes rejected');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to reject changes');
    },
  });

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 25));
  const handleResetZoom = () => setZoom(100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading comparison...</div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">Comparison not found</div>
        <Button variant="outline" onClick={() => router.push('/visual')}>
          Back to Visual
        </Button>
      </div>
    );
  }

  // Compute display values from raw API data
  const status = comparison.status?.toUpperCase() || 'PENDING';
  const isPending = status === 'PENDING';
  const isChanged = status === 'CHANGED';
  const needsReview = isPending || isChanged;

  // Current screenshot URL
  const currentUrl = comparison.currentUrl || screenshotProxyUrl(comparison.screenshot?.url);

  // Baseline URL: extract from baseline.screenshots JSON array, matching by name
  const baselineUrl = (() => {
    if (comparison.baselineUrl) return comparison.baselineUrl;
    if (comparison.baseline?.url) return screenshotProxyUrl(comparison.baseline.url);
    // baseline.screenshots is a JSON array of { name, url, width, height }
    const screenshots = comparison.baseline?.screenshots;
    if (screenshots) {
      const arr = typeof screenshots === 'string' ? JSON.parse(screenshots) : screenshots;
      if (Array.isArray(arr) && arr.length > 0) {
        // Try to match by current screenshot name
        const screenshotName = comparison.screenshot?.name;
        const match = screenshotName
          ? arr.find((s: { name: string; url: string }) => s.name === screenshotName)
          : arr[0];
        return screenshotProxyUrl((match || arr[0]).url);
      }
    }
    return undefined;
  })();

  const diffUrl = comparison.diffUrl ? screenshotProxyUrl(comparison.diffUrl) : undefined;
  const diffPercentage = comparison.diffPercentage ?? comparison.diffScore ?? 0;
  const testId = comparison.testId || comparison.executionId || comparison.id;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/visual')}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                Visual Comparison
              </h1>
              <Badge
                variant="secondary"
                className={cn(
                  status === 'APPROVED' &&
                    'bg-green-500/10 text-green-400',
                  status === 'REJECTED' &&
                    'bg-red-500/10 text-red-400',
                  (status === 'PENDING' || status === 'AUTO_APPROVED') &&
                    'bg-yellow-500/10 text-yellow-400',
                  (status === 'CHANGED' || status === 'ESCALATED') &&
                    'bg-blue-500/10 text-blue-400'
                )}
              >
                {status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {diffPercentage !== undefined
                ? `${diffPercentage.toFixed(2)}% difference detected`
                : 'Calculating difference...'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {needsReview && (
            <>
              <Button
                variant="outline"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="bg-card border-red-800 text-red-400 hover:bg-red-500/10 hover:border-red-700"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve as Baseline
              </Button>
              <Button
                variant="outline"
                className="border-orange-600/30 text-orange-400 hover:bg-orange-500/10"
                onClick={() => {
                  api.post('/fixes/candidates', {
                    projectId: project?.id,
                    comparisonId,
                    executionId: comparison?.executionId,
                    sourceType: 'comparison',
                    title: `Visual regression: ${comparison?.baseline?.name || comparisonId}`,
                    plainLanguageSummary: `Visual difference of ${comparison?.diffScore?.toFixed(1)}% detected`,
                    failureType: 'VISUAL',
                    severity: (comparison?.diffScore || 0) > 20 ? 'HIGH' : 'MEDIUM',
                    classification: 'PRODUCT_BUG',
                  }).then((data: any) => {
                    toast.success('Bug candidate created');
                    router.push(`/fixes/${data.id}`);
                  }).catch(() => toast.error('Failed to create bug candidate'));
                }}
              >
                Investigate Root Cause
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Prev/Next Navigation */}
      {allComparisons && allComparisons.length > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevComparison}
            onClick={() => prevComparison && router.push(`/visual/${prevComparison.id}`)}
          >
            <ArrowLeft className="h-3 w-3 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {comparisonIndex + 1} of {allComparisons.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextComparison}
            onClick={() => nextComparison && router.push(`/visual/${nextComparison.id}`)}
          >
            Next <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
          </Button>
        </div>
      )}

      {/* View Mode Tabs */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as ViewMode)}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <TabsList className="bg-card border border-border">
            <TabsTrigger
              value="side-by-side"
              className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
            >
              <SplitSquareHorizontal className="w-4 h-4 mr-2" />
              Side by Side
            </TabsTrigger>
            <TabsTrigger
              value="overlay"
              className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
            >
              <Layers className="w-4 h-4 mr-2" />
              Overlay
            </TabsTrigger>
            <TabsTrigger
              value="diff"
              className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
            >
              <Image className="w-4 h-4 mr-2" />
              Diff View
            </TabsTrigger>
          </TabsList>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Side by Side View */}
        <TabsContent value="side-by-side" className="m-0">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Baseline
                </h3>
                <div
                  className="aspect-video bg-muted rounded-lg overflow-auto"
                  style={{ maxHeight: '70vh' }}
                >
                  {baselineUrl ? (
                    <img
                      src={baselineUrl}
                      alt="Baseline"
                      className="object-contain transition-transform"
                      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground">No baseline</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Current
                </h3>
                <div
                  className="aspect-video bg-muted rounded-lg overflow-auto"
                  style={{ maxHeight: '70vh' }}
                >
                  {currentUrl ? (
                    <img
                      src={currentUrl}
                      alt="Current"
                      className="object-contain transition-transform"
                      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground">No current snapshot</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Overlay View */}
        <TabsContent value="overlay" className="m-0">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Overlay Comparison
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Baseline</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-32 h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">Current</span>
                </div>
              </div>
              <div
                className="relative bg-muted rounded-lg overflow-auto"
                style={{ maxHeight: '70vh' }}
              >
                {baselineUrl && (
                  <img
                    src={baselineUrl}
                    alt="Baseline"
                    className="absolute inset-0 object-contain transition-opacity"
                    style={{
                      opacity: (100 - overlayOpacity) / 100,
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'top left',
                    }}
                  />
                )}
                {currentUrl && (
                  <img
                    src={currentUrl}
                    alt="Current"
                    className="relative object-contain transition-opacity"
                    style={{
                      opacity: overlayOpacity / 100,
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'top left',
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diff View */}
        <TabsContent value="diff" className="m-0">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Difference Highlight
              </h3>
              <div
                className="bg-muted rounded-lg overflow-auto"
                style={{ maxHeight: '70vh' }}
              >
                {diffUrl ? (
                  <img
                    src={diffUrl}
                    alt="Diff"
                    className="object-contain transition-transform"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center">
                    <div className="text-center">
                      <Image className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        Diff image not yet generated
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Metadata */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Comparison ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {comparison.id.slice(0, 12)}...
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Created</p>
              <p className="text-sm text-muted-foreground">
                {new Date(comparison.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Difference</p>
              <p
                className={cn(
                  'text-sm font-medium',
                  diffPercentage > 5
                    ? 'text-red-400'
                    : diffPercentage > 1
                    ? 'text-yellow-400'
                    : 'text-green-400'
                )}
              >
                {`${diffPercentage.toFixed(4)}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Execution ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {testId.slice(0, 12)}...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
