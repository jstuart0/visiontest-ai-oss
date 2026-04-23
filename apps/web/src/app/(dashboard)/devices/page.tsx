'use client';

// Devices — Sheet · Device set.
// A roster of named viewport/browser variants. Each device = D-XXX part ID
// with viewport dimensions in mono, platform chip, scale factor.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Edit,
  Search,
} from 'lucide-react';
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
import { PlatformFilter } from '@/components/devices/PlatformFilter';
import { MobileViewportPreview } from '@/components/devices/MobileViewportPreview';
import { useSortableTable } from '@/hooks/useSortableTable';
import { devicesApi, type DeviceProfile, type Platform } from '@/lib/api';
import { toast } from 'sonner';
import { VtStage } from '@/components/shell/AppShell';
import { EditorialHero } from '@/components/shell/EditorialHero';

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteDevice, setDeleteDevice] = useState<DeviceProfile | null>(null);
  const [editDevice, setEditDevice] = useState<DeviceProfile | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DeviceProfile | null>(null);
  const { sortData } = useSortableTable<DeviceProfile>();

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
    refetchInterval: 30000,
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

  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const totalCt = devices.length;
  const builtInCt = devices.filter((d: DeviceProfile) => d.isBuiltIn).length;
  const customCt = totalCt - builtInCt;

  return (
    <VtStage width="wide">
      <EditorialHero
        width="wide"
        sheet="D · DEVICE SET"
        eyebrow="§ 01 · BENCH"
        revision={<>REV · 02 · {isoDate}</>}
        title={
          <>
            device <em>roster</em>.
          </>
        }
        lead={
          'Named viewport variants. Every profile is a part — platform, dimensions, scale, user-agent — filed against a D-number. The runner composes these against tests to produce plate photography.'
        }
        actions={
          <button onClick={() => setCreateOpen(true)} className="vt-btn vt-btn--primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            NEW PROFILE
          </button>
        }
      >
        {/* Title-block */}
        <div className="vt-title-block">
          <div className="span3">
            <span className="k">REGISTER</span>
            <span className="v big">device profiles</span>
          </div>
          <div className="span2">
            <span className="k">SHEET ID</span>
            <span className="v">VT-DEV-{String(totalCt).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">REV</span>
            <span className="v" style={{ color: 'var(--accent)' }}>02</span>
          </div>
          <div>
            <span className="k">TOTAL</span>
            <span className="v">{String(totalCt).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">BUILT-IN</span>
            <span className="v">{String(builtInCt).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">CUSTOM</span>
            <span className="v" style={{ color: 'var(--accent)' }}>{String(customCt).padStart(3, '0')}</span>
          </div>
          <div>
            <span className="k">CONNECTED</span>
            <span className="v" style={{ color: availableDevices.length ? 'var(--pass)' : 'var(--ink-2)' }}>
              {String(availableDevices.length).padStart(2, '0')}
            </span>
          </div>
          <div>
            <span className="k">DRAWN</span>
            <span className="v">{isoDate}</span>
          </div>
        </div>

        {/* Connected bench banner */}
        {availableDevices.length > 0 && (
          <section>
            <div className="vt-section-head">
              <span className="num">§ 02</span>
              <span className="ttl">bench · live</span>
              <span className="rule" />
              <span className="stamp">{String(availableDevices.length).padStart(2, '0')} ATTACHED</span>
            </div>
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              <div className="flex flex-wrap items-center gap-0">
                {availableDevices.map((d: any, i: number) => (
                  <div
                    key={d.id}
                    className="px-4 py-3"
                    style={{
                      borderRight: i < availableDevices.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ color: 'var(--pass)', marginRight: '8px' }}>●</span>
                    {d.name}
                    <span style={{ color: 'var(--ink-2)', marginLeft: '8px' }}>· {d.state}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Filters */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ {availableDevices.length > 0 ? '03' : '02'}</span>
            <span className="ttl">filter · search</span>
            <span className="rule" />
            <span className="stamp">{String(filtered.length).padStart(2, '0')} OF {String(totalCt).padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />
            <div className="relative flex-1 min-w-[240px] max-w-[420px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: 'var(--ink-2)' }}
                strokeWidth={1.5}
              />
              <input
                type="search"
                placeholder="SEARCH · DEVICES"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="vt-input"
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>
          </div>
        </section>

        {/* Device roster */}
        <section>
          <div className="vt-section-head">
            <span className="num">§ {availableDevices.length > 0 ? '04' : '03'}</span>
            <span className="ttl">schedule of devices</span>
            <span className="rule" />
            <span className="stamp">PART · NAME · PLATFORM · DIM · SCALE</span>
          </div>

          {isLoading ? (
            <LoadingPlate label="READING BENCH" />
          ) : filtered.length === 0 ? (
            <EmptyPlate
              heading="no devices on file."
              body="Add a profile, or unfilter to see the built-in set. Each profile becomes a part filed under D-xxx."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--rule-strong)',
                background: 'color-mix(in oklab, var(--bg-1) 40%, transparent)',
              }}
            >
              {/* header */}
              <div
                className="grid grid-cols-[70px_1fr_120px_140px_80px_110px_90px] gap-0"
                style={{
                  borderBottom: '1px solid var(--rule-strong)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-2)',
                }}
              >
                {['PART', 'NAME', 'PLATFORM', 'DIMENSION', 'SCALE', 'TYPE', 'ACT'].map((h, i) => (
                  <div
                    key={h}
                    className="py-3 px-4"
                    style={{
                      borderRight: i < 6 ? '1px solid var(--rule)' : 'none',
                      textAlign: i === 6 ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {filtered.map((device: DeviceProfile, i: number) => (
                <div
                  key={device.id}
                  className="grid grid-cols-[70px_1fr_120px_140px_80px_110px_90px] gap-0 group"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    transition: 'background var(--dur-quick) var(--ease-out)',
                    animation: `vt-reveal var(--dur-reveal) ${(i + 1) * 30}ms var(--ease-out) both`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      'color-mix(in oklab, var(--bg-2) 35%, transparent)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="py-3 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10.5px',
                      letterSpacing: '0.14em',
                      color: 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    D-{String(i + 1).padStart(3, '0')}
                  </div>
                  <button
                    onClick={() => setPreviewDevice(device)}
                    className="py-3 px-4 text-left"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      color: 'var(--ink-0)',
                      textTransform: 'lowercase',
                    }}
                  >
                    <div
                      className="transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-0)')}
                    >
                      {device.name}
                    </div>
                    {device.osVersion && (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9.5px',
                          letterSpacing: '0.14em',
                          color: 'var(--ink-2)',
                          textTransform: 'uppercase',
                          marginTop: '3px',
                        }}
                      >
                        OS · {device.osVersion}
                      </div>
                    )}
                  </button>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <PlatformChip platform={device.platform} />
                  </div>
                  <div
                    className="py-3 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ⊢ {device.width} × {device.height} ⊣
                  </div>
                  <div
                    className="py-3 px-4"
                    style={{
                      borderRight: '1px solid var(--rule-soft)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      color: 'var(--ink-1)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {device.scaleFactor}×
                  </div>
                  <div
                    className="py-3 px-4 flex items-center"
                    style={{ borderRight: '1px solid var(--rule-soft)' }}
                  >
                    <span
                      className={device.isBuiltIn ? 'vt-chip' : 'vt-chip vt-chip--accent'}
                      style={{ fontSize: '9.5px', padding: '3px 8px' }}
                    >
                      {device.isBuiltIn ? 'BUILT-IN' : 'CUSTOM'}
                    </span>
                  </div>
                  <div className="py-3 px-4 flex justify-end items-center gap-2">
                    {!device.isBuiltIn && (
                      <>
                        <button
                          type="button"
                          aria-label="Edit"
                          onClick={() => {
                            setEditDevice(device);
                            setFormData({
                              name: device.name,
                              platform: device.platform,
                              width: device.width,
                              height: device.height,
                              scaleFactor: device.scaleFactor || 1,
                              userAgent: device.userAgent || '',
                              osVersion: device.osVersion || '',
                            });
                          }}
                          className="w-7 h-7 flex items-center justify-center transition-colors"
                          style={{ border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--ink-2)';
                            e.currentTarget.style.borderColor = 'var(--rule)';
                          }}
                        >
                          <Edit className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => setDeleteDevice(device)}
                          className="w-7 h-7 flex items-center justify-center transition-colors"
                          style={{ border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--fail)';
                            e.currentTarget.style.borderColor = 'var(--fail)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--ink-2)';
                            e.currentTarget.style.borderColor = 'var(--rule)';
                          }}
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Colophon sheet="DEVICE SET" count={filtered.length} />
      </EditorialHero>

      {/* Preview dialog */}
      <Dialog open={!!previewDevice} onOpenChange={() => setPreviewDevice(null)}>
        <DialogContent
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--rule-strong)',
            maxWidth: '28rem',
          }}
        >
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              {previewDevice?.name}
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              DETAIL A · ORTHOGRAPHIC PREVIEW
            </DialogDescription>
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}>
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              new device profile
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              FILE AS D-xxx · CUSTOM
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FieldLabel label="DEVICE NAME">
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="IPHONE 16"
                className="vt-input"
              />
            </FieldLabel>
            <FieldLabel label="PLATFORM">
              <Select
                value={formData.platform}
                onValueChange={(v) => setFormData({ ...formData, platform: v as Platform })}
              >
                <SelectTrigger
                  className="vt-input"
                  style={{ textAlign: 'left' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}
                >
                  <SelectItem value="WEB">Web</SelectItem>
                  <SelectItem value="IOS">iOS</SelectItem>
                  <SelectItem value="ANDROID">Android</SelectItem>
                  <SelectItem value="MOBILE_WEB">Mobile Web</SelectItem>
                </SelectContent>
              </Select>
            </FieldLabel>
            <div className="grid grid-cols-3 gap-3">
              <FieldLabel label="WIDTH">
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0 })}
                  className="vt-input"
                />
              </FieldLabel>
              <FieldLabel label="HEIGHT">
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0 })}
                  className="vt-input"
                />
              </FieldLabel>
              <FieldLabel label="SCALE">
                <input
                  type="number"
                  step="0.1"
                  value={formData.scaleFactor}
                  onChange={(e) => setFormData({ ...formData, scaleFactor: parseFloat(e.target.value) || 1 })}
                  className="vt-input"
                />
              </FieldLabel>
            </div>
            <FieldLabel label="OS VERSION · OPTIONAL">
              <input
                value={formData.osVersion}
                onChange={(e) => setFormData({ ...formData, osVersion: e.target.value })}
                placeholder="17.0"
                className="vt-input"
              />
            </FieldLabel>
            <FieldLabel label="USER AGENT · OPTIONAL">
              <input
                value={formData.userAgent}
                onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })}
                placeholder="CUSTOM USER AGENT"
                className="vt-input"
              />
            </FieldLabel>
          </div>
          <DialogFooter>
            <button onClick={() => setCreateOpen(false)} className="vt-btn vt-btn--ghost">
              CANCEL
            </button>
            <button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || createMutation.isPending}
              className="vt-btn vt-btn--primary"
            >
              {createMutation.isPending ? 'FILING…' : 'FILE PROFILE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
        <DialogContent style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}>
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--ink-0)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              edit profile
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-2)',
              }}
            >
              REVISING · {editDevice?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FieldLabel label="NAME">
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="vt-input"
              />
            </FieldLabel>
            <div className="grid grid-cols-3 gap-3">
              <FieldLabel label="WIDTH">
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0 })}
                  className="vt-input"
                />
              </FieldLabel>
              <FieldLabel label="HEIGHT">
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0 })}
                  className="vt-input"
                />
              </FieldLabel>
              <FieldLabel label="SCALE">
                <input
                  type="number"
                  step="0.5"
                  value={formData.scaleFactor}
                  onChange={(e) => setFormData({ ...formData, scaleFactor: parseFloat(e.target.value) || 1 })}
                  className="vt-input"
                />
              </FieldLabel>
            </div>
            <FieldLabel label="USER AGENT">
              <input
                value={formData.userAgent}
                onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })}
                className="vt-input"
              />
            </FieldLabel>
          </div>
          <DialogFooter>
            <button onClick={() => setEditDevice(null)} className="vt-btn vt-btn--ghost">
              CANCEL
            </button>
            <button
              onClick={() => editDevice && updateMutation.mutate({ id: editDevice.id, data: formData })}
              disabled={updateMutation.isPending}
              className="vt-btn vt-btn--primary"
            >
              {updateMutation.isPending ? 'SAVING…' : 'SAVE REVISION'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDevice} onOpenChange={() => setDeleteDevice(null)}>
        <DialogContent style={{ background: 'var(--bg-1)', border: '1px solid var(--rule-strong)' }}>
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--fail)',
                textTransform: 'lowercase',
                fontSize: '24px',
              }}
            >
              delete profile
            </DialogTitle>
            <DialogDescription
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--ink-1)',
                fontSize: '14px',
              }}
            >
              Delete &ldquo;{deleteDevice?.name}&rdquo; from the register. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setDeleteDevice(null)} className="vt-btn vt-btn--ghost">
              CANCEL
            </button>
            <button
              onClick={() => deleteDevice && deleteMutation.mutate(deleteDevice.id)}
              disabled={deleteMutation.isPending}
              className="vt-btn"
              style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }}
            >
              {deleteMutation.isPending ? 'DELETING…' : 'CONFIRM · DELETE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VtStage>
  );
}

/* ── primitives ── */

function PlatformChip({ platform }: { platform: string }) {
  const label = platform === 'MOBILE_WEB' ? 'MOBILE WEB' : platform;
  return (
    <span className="vt-chip" style={{ fontSize: '9.5px', padding: '3px 8px' }}>
      {label}
    </span>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          marginBottom: '6px',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function LoadingPlate({ label }: { label: string }) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: 'var(--ink-2)',
      }}
    >
      — {label} —
    </div>
  );
}

function EmptyPlate({ heading, body }: { heading: string; body: string }) {
  return (
    <div
      className="p-12 text-center"
      style={{
        border: '1px dashed var(--rule-strong)',
        background: 'color-mix(in oklab, var(--bg-1) 25%, transparent)',
      }}
    >
      <div
        className="vt-kicker"
        style={{ color: 'var(--ink-2)', justifyContent: 'center' }}
      >
        PLATE EMPTY
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 2.6vw, 34px)',
          color: 'var(--ink-0)',
          textTransform: 'lowercase',
        }}
      >
        {heading}
      </h3>
      <p
        className="mt-3 mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          maxWidth: '52ch',
          color: 'var(--ink-1)',
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function Colophon({ sheet, count }: { sheet: string; count: number }) {
  return (
    <footer
      className="pt-6 flex justify-between gap-4 flex-wrap"
      style={{
        borderTop: '1px solid var(--rule)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--ink-2)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span>SHEET · {sheet}</span>
      <span>COUNT · {String(count).padStart(3, '0')}</span>
      <span>CHECKED · VT</span>
    </footer>
  );
}
