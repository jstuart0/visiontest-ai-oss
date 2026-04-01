'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentProject } from '@/hooks/useProject';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { testsApi, masksApi, type Test, type Mask } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MaskEditor } from '@/components/visual/MaskEditor';

export default function MasksPage() {
  const { project } = useCurrentProject();
  const [search, setSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const { sortColumn, sortDirection, handleSort, sortData } = useSortableTable<Test>();

  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['tests', project?.id],
    queryFn: () => testsApi.list(project!.id),
    enabled: !!project?.id,
  });

  const { data: masks, isLoading: masksLoading } = useQuery({
    queryKey: ['masks', project?.id, selectedTest?.id],
    queryFn: () => masksApi.list(project!.id, { testId: selectedTest!.id }),
    enabled: !!project?.id && !!selectedTest?.id,
  });

  const filteredTests = sortData(
    tests?.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    ) || [],
    {
      name: (t) => t.name,
    }
  );

  const handleEditMasks = (test: Test) => {
    setSelectedTest(test);
    setShowEditor(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ignore Masks</h1>
          <p className="text-muted-foreground mt-1">
            Define regions to ignore during visual comparison
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            About Ignore Masks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                What are Ignore Masks?
              </h4>
              <p className="text-sm text-muted-foreground">
                Ignore masks allow you to define specific regions of your visual
                snapshots that should be excluded from comparison. This is useful
                for dynamic content like timestamps, ads, or user-specific data.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                When to Use Masks
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Dynamic content (dates, times, counters)</li>
                <li>• Third-party widgets (ads, chat widgets)</li>
                <li>• User-specific data (avatars, names)</li>
                <li>• Animated regions (carousels, loaders)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Tests Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Tests with Masks</CardTitle>
          <CardDescription className="text-muted-foreground">
            Select a test to manage its ignore masks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading tests...
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Layers className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No Tests Found
              </h3>
              <p className="text-muted-foreground text-center max-w-md">
                {search
                  ? 'No tests match your search'
                  : 'Create tests first to add ignore masks'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <SortableTableHead column="name" label="Test Name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <TableHead className="text-muted-foreground">Masks</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTests.map((test) => (
                  <TableRow
                    key={test.id}
                    className="border-border hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleEditMasks(test)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{test.name}</div>
                      {test.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {test.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        {/* This would need to be fetched per test */}
                        Click to view
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditMasks(test);
                        }}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit Masks
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mask Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Edit Masks: {selectedTest?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Draw rectangles on the image to create ignore regions
            </DialogDescription>
          </DialogHeader>
          {selectedTest && project && (
            <MaskEditor
              projectId={project.id}
              testId={selectedTest.id}
              onClose={() => setShowEditor(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
