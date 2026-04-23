'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone,
  Plus,
  Monitor,
  Tablet,
  Trash2,
  Edit,
  Search,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PlatformFilter } from '@/components/devices/PlatformFilter';
import { MobileViewportPreview } from '@/components/devices/MobileViewportPreview';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useSortableTable } from '@/hooks/useSortableTable';
import { devicesApi, type DeviceProfile, type Platform } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const platformIcons: Record<string, typeof Monitor> = {
  WEB: Monitor,
  IOS: Smartphone,
  ANDROID: Smartphone,
  MOBILE_WEB: Tablet,
};

const platformColors: Record<string, string> = {
  WEB: 'text-blue-400',
  IOS: 'text-muted-foreground',
  ANDROID: 'text-green-400',
  MOBILE_WEB: 'text-purple-400',
};

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteDevice, setDeleteDevice] = useState<DeviceProfile | null>(null);
  const [editDevice, setEditDevice] = useState<DeviceProfile | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DeviceProfile | null>(null);
  const { sortColumn, sortDirection, handleSort, sortData } = useSortableTable<DeviceProfile>();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    platform: 'IOS' as Platform,
    width: 390,
    height: 844,
    scaleFactor: 3,
    userAgent: '',
    osVersion: '',
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', platformFilter],
    queryFn: () =>
      devicesApi.list({
        platform: platformFilter || undefined,
      }),
  });

  const { data: availableDevices = [] } = useQuery({
    queryKey: ['devices-available'],
    queryFn: () => devicesApi.available(),
    refetchInterval: 30000, // Check every 30 seconds
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      devicesApi.create({
        ...data,
        isEmulator: true,
        config: {},
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device profile created');
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => devicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device profile updated');
      setEditDevice(null);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => devicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device profile deleted');
      setDeleteDevice(null);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      platform: 'IOS',
      width: 390,
      height: 844,
      scaleFactor: 3,
      userAgent: '',
      osVersion: '',
    });
  };

  const filtered = sortData(
    devices.filter((d: DeviceProfile) => {
      if (search) {
        const q = search.toLowerCase();
        if (!d.name.toLowerCase().includes(q)) return false;
      }
      return true;
    }),
    {
      device: (d) => d.name,
      platform: (d) => d.platform,
      resolution: (d) => d.width * 10000 + d.height,
      scale: (d) => d.scaleFactor,
      type: (d) => (d.isBuiltIn ? 'Built-in' : 'Custom'),
    }
  );

  // Hardware bench — mobile emulation profiles. Headline treats the
  // list as a cabinet of devices on a workbench.
  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-10 vt-reveal">
      <header className="pb-7 border-b mb-10 flex items-start justify-between gap-6 flex-wrap" style={{ borderColor: 'var(--rule)' }}>
        <div>
          <div className="vt-eyebrow mb-5">§ Bench · Device profiles</div>
          <h1 className="vt-display" style={{ fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 0.98 }}>
            The <em>hardware</em> shelf.
          </h1>
          <p className="mt-4 vt-italic" style={{ fontVariationSettings: '"opsz" 24', fontSize: '17px', color: 'var(--ink-1)', maxWidth: '60ch' }}>
            Screen sizes, pixel ratios, user-agent strings. Each profile is a
            physical-device stand-in for what the browser pretends to be.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="vt-btn vt-btn--primary shrink-0"
        >
          <Plus className="w-4 h-4" />
          New profile
        </Button>
      </header>

      {/* Connected Devices Banner */}
      {availableDevices.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
          <Wifi className="w-5 h-5 text-green-400" />
          <span className="text-green-400 text-sm">
            {availableDevices.length} device{availableDevices.length !== 1 ? 's' : ''} available
          </span>
          <div className="flex gap-2 ml-auto">
            {availableDevices.slice(0, 3).map((d: any) => (
              <Badge key={d.id} variant="secondary" className="bg-green-900/30 text-green-300 text-xs">
                {d.name} ({d.state})
              </Badge>
            ))}
            {availableDevices.length > 3 && (
              <Badge variant="secondary" className="bg-green-900/30 text-green-300 text-xs">
                +{availableDevices.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>
      </div>

      {/* Devices Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <SortableTableHead column="device" label="Device" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="platform" label="Platform" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="resolution" label="Resolution" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="scale" label="Scale" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead column="type" label="Type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading devices...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No device profiles found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((device: DeviceProfile) => {
                const Icon = platformIcons[device.platform] || Monitor;
                return (
                  <TableRow key={device.id} className="border-border hover:bg-accent/50">
                    <TableCell>
                      <button
                        onClick={() => setPreviewDevice(device)}
                        className="flex items-center gap-3 text-left hover:text-blue-400 transition-colors"
                      >
                        <Icon className={cn('w-5 h-5', platformColors[device.platform])} />
                        <div>
                          <div className="font-medium text-foreground">{device.name}</div>
                          {device.osVersion && (
                            <div className="text-xs text-muted-foreground">{device.osVersion}</div>
                          )}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          device.platform === 'IOS' && 'bg-muted/50 text-muted-foreground',
                          device.platform === 'ANDROID' && 'bg-green-500/10 text-green-400',
                          device.platform === 'MOBILE_WEB' && 'bg-purple-500/10 text-purple-400',
                          device.platform === 'WEB' && 'bg-blue-500/10 text-blue-400'
                        )}
                      >
                        {device.platform === 'MOBILE_WEB' ? 'Mobile Web' : device.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {device.width}×{device.height}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.scaleFactor}x
                    </TableCell>
                    <TableCell>
                      {device.isBuiltIn ? (
                        <Badge variant="secondary" className="text-xs bg-muted/50 text-muted-foreground">
                          Built-in
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-400">
                          Custom
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!device.isBuiltIn && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                            onClick={() => {
                              setEditDevice(device);
                              setFormData({
                                name: device.name,
                                platform: device.platform,
                                width: device.width,
                                height: device.height,
                                scaleFactor: device.scaleFactor || 1,
                                userAgent: device.userAgent || '',
                              });
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-accent"
                            onClick={() => setDeleteDevice(device)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Device Preview Dialog */}
      <Dialog open={!!previewDevice} onOpenChange={() => setPreviewDevice(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{previewDevice?.name}</DialogTitle>
          </DialogHeader>
          {previewDevice && (
            <div className="flex justify-center py-4">
              <MobileViewportPreview
                platform={previewDevice.platform}
                width={previewDevice.width}
                height={previewDevice.height}
                deviceName={previewDevice.name}
                maxHeight={350}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Device Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Device Profile</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a custom device profile for testing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Device Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., iPhone 16"
                className="bg-muted border-border text-foreground mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(v) => setFormData({ ...formData, platform: v as Platform })}
              >
                <SelectTrigger className="bg-muted border-border text-foreground mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="WEB" className="text-muted-foreground">Web</SelectItem>
                  <SelectItem value="IOS" className="text-muted-foreground">iOS</SelectItem>
                  <SelectItem value="ANDROID" className="text-muted-foreground">Android</SelectItem>
                  <SelectItem value="MOBILE_WEB" className="text-muted-foreground">Mobile Web</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-muted-foreground">Width</Label>
                <Input
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border text-foreground mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Height</Label>
                <Input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0 })}
                  className="bg-muted border-border text-foreground mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Scale</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.scaleFactor}
                  onChange={(e) => setFormData({ ...formData, scaleFactor: parseFloat(e.target.value) || 1 })}
                  className="bg-muted border-border text-foreground mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">OS Version (optional)</Label>
              <Input
                value={formData.osVersion}
                onChange={(e) => setFormData({ ...formData, osVersion: e.target.value })}
                placeholder="e.g., 17.0"
                className="bg-muted border-border text-foreground mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">User Agent (optional)</Label>
              <Input
                value={formData.userAgent}
                onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })}
                placeholder="Custom user agent string"
                className="bg-muted border-border text-foreground mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Device Profile</DialogTitle>
            <DialogDescription className="text-muted-foreground">Update device profile settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-muted border-border text-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-muted-foreground">Width</Label><Input type="number" value={formData.width} onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0 })} className="bg-muted border-border text-foreground" /></div>
              <div><Label className="text-muted-foreground">Height</Label><Input type="number" value={formData.height} onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0 })} className="bg-muted border-border text-foreground" /></div>
              <div><Label className="text-muted-foreground">Scale</Label><Input type="number" step="0.5" value={formData.scaleFactor} onChange={(e) => setFormData({ ...formData, scaleFactor: parseFloat(e.target.value) || 1 })} className="bg-muted border-border text-foreground" /></div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">User Agent</Label>
              <Input value={formData.userAgent} onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })} className="bg-muted border-border text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDevice(null)}>Cancel</Button>
            <Button onClick={() => editDevice && updateMutation.mutate({ id: editDevice.id, data: formData })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteDevice} onOpenChange={() => setDeleteDevice(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Device Profile</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete &quot;{deleteDevice?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDevice(null)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDevice && deleteMutation.mutate(deleteDevice.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
