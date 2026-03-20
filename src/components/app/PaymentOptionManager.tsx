import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import {
  CreditCard,
  Eye,
  ImageIcon,
  Link,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

function encodeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

type PaymentOptionType = 'e-wallet' | 'bank';

interface PaymentOption {
  _id: string;
  storeId: string;
  type: PaymentOptionType;
  recipientName: string;
  qrImageUrl: string;
  label?: string;
  accountDetails?: string;
  isActive: boolean;
  createdAt: string;
}

interface FormData {
  type: PaymentOptionType;
  recipientName: string;
  qrImageUrl: string;
  label: string;
  accountDetails: string;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  type: 'e-wallet',
  recipientName: '',
  qrImageUrl: '',
  label: '',
  accountDetails: '',
  isActive: true,
};

interface PaymentOptionManagerProps {
  storeId: string;
}

function QrPreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  if (!url) return null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">QR Preview</p>
      <div className="relative flex h-48 w-48 items-center justify-center rounded-lg border border-border bg-white overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
            <QrCode className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted/60">
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Unable to load image</p>
          </div>
        )}
        <img
          src={url}
          alt="QR preview"
          className={`h-full w-full object-contain transition-opacity ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      </div>
      {status === 'loaded' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Image loaded successfully</p>
      )}
    </div>
  );
}

export function PaymentOptionManager({ storeId }: PaymentOptionManagerProps) {
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<PaymentOption | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOption, setDeletingOption] = useState<PaymentOption | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewOption, setPreviewOption] = useState<PaymentOption | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [useUrlInput, setUseUrlInput] = useState(false);
  const [encodingFile, setEncodingFile] = useState(false);
  const [fileName, setFileName] = useState('');

  const fetchOptions = async () => {
    try {
      const res = await fetch(`/api/payment-options/store/${storeId}`);
      if (res.ok) setOptions(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOptions(); }, [storeId]);

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  };

  const resetFileState = () => {
    setFileName('');
    setUseUrlInput(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditingOption(null);
    setForm(EMPTY_FORM);
    setFormError('');
    resetFileState();
    setDialogOpen(true);
  };

  const openEdit = (option: PaymentOption) => {
    setEditingOption(option);
    setForm({
      type: option.type,
      recipientName: option.recipientName,
      qrImageUrl: option.qrImageUrl,
      label: option.label ?? '',
      accountDetails: option.accountDetails ?? '',
      isActive: option.isActive,
    });
    setFormError('');
    // If the stored value is a Base64 data URL show it as an uploaded file; otherwise show URL mode
    const isBase64 = option.qrImageUrl.startsWith('data:');
    setUseUrlInput(!isBase64);
    setFileName(isBase64 ? 'Previously uploaded image' : '');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setDialogOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFormError('Image must be smaller than 2 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFormError('');
    setEncodingFile(true);
    try {
      const dataUrl = await encodeImageFile(file);
      updateField('qrImageUrl', dataUrl);
      setFileName(file.name);
    } catch {
      setFormError('Failed to read the image file. Please try again.');
    } finally {
      setEncodingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName.trim()) { setFormError('Recipient name is required.'); return; }
    if (!form.qrImageUrl.trim()) { setFormError('QR code image URL is required.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        recipientName: form.recipientName.trim(),
        qrImageUrl: form.qrImageUrl.trim(),
        label: form.label.trim() || undefined,
        accountDetails: form.accountDetails.trim() || undefined,
        isActive: form.isActive,
      };

      let res: Response;
      if (editingOption) {
        res = await fetch(`/api/payment-options/${editingOption._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/payment-options/store/${storeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { message?: string }).message ?? 'Something went wrong.');
        return;
      }

      toast.success(editingOption ? 'Payment option updated.' : 'Payment option added.');
      setDialogOpen(false);
      await fetchOptions();
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (option: PaymentOption) => {
    setDeletingOption(option);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingOption) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/payment-options/${deletingOption._id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete payment option.'); return; }
      toast.success('Payment option deleted.');
      setDeleteDialogOpen(false);
      setDeletingOption(null);
      await fetchOptions();
    } finally {
      setDeleting(false);
    }
  };

  const openPreview = (option: PaymentOption) => {
    setPreviewOption(option);
    setPreviewDialogOpen(true);
  };

  const paginated = options.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Options</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage QR codes and payment methods for your store.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Payment Option
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">QR Code</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label / Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recipient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account Details</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="px-4 py-3"><Skeleton className="h-16 w-16 rounded-lg" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-8 w-20 rounded-lg" /></td>
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <QrCode className="h-8 w-8 text-muted-foreground/40" />
                    <p>No payment options yet.</p>
                    <p className="text-xs">Click "Add Payment Option" to get started.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((option) => (
                <tr key={option._id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openPreview(option)}
                      className="group relative h-16 w-16 rounded-lg overflow-hidden border border-border bg-white hover:ring-2 hover:ring-primary/40 transition-all"
                      title="Click to view full QR code"
                    >
                      <QrImageCell url={option.qrImageUrl} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                        <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{option.label || '—'}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {option.type === 'e-wallet'
                        ? <Wallet className="h-3 w-3 text-muted-foreground" />
                        : <CreditCard className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground capitalize">{option.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{option.recipientName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{option.accountDetails || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={option.isActive ? 'default' : 'secondary'}>
                      {option.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(option)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(option)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && options.length > ITEMS_PER_PAGE && (
        <TablePagination
          currentPage={page}
          totalItems={options.length}
          onPageChange={setPage}
        />
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOption ? 'Edit Payment Option' : 'Add Payment Option'}</DialogTitle>
            <DialogDescription>
              {editingOption
                ? 'Update the details for this payment method.'
                : 'Add a new payment method with a QR code for your customers.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as PaymentOptionType)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="e-wallet">
                    <span className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" /> E-Wallet
                    </span>
                  </SelectItem>
                  <SelectItem value="bank">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Bank
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="label">
                Label <span className="text-muted-foreground text-xs">(optional — e.g. GCash, BPI)</span>
              </Label>
              <Input
                id="label"
                placeholder="e.g. GCash, BPI Savings"
                value={form.label}
                onChange={(e) => updateField('label', e.target.value)}
              />
            </div>

            {/* Recipient Name */}
            <div className="space-y-1.5">
              <Label htmlFor="recipientName">Recipient Name <span className="text-destructive">*</span></Label>
              <Input
                id="recipientName"
                placeholder="e.g. Juan Dela Cruz"
                value={form.recipientName}
                onChange={(e) => updateField('recipientName', e.target.value)}
                required
              />
            </div>

            {/* Account Details */}
            <div className="space-y-1.5">
              <Label htmlFor="accountDetails">
                Account Details <span className="text-muted-foreground text-xs">(optional — masked ok)</span>
              </Label>
              <Input
                id="accountDetails"
                placeholder="e.g. 09XX-XXX-9876"
                value={form.accountDetails}
                onChange={(e) => updateField('accountDetails', e.target.value)}
              />
            </div>

            {/* QR Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  QR Code Image <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setUseUrlInput((v) => !v);
                    updateField('qrImageUrl', '');
                    setFileName('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {useUrlInput ? (
                    <><Upload className="h-3 w-3" /> Upload file instead</>
                  ) : (
                    <><Link className="h-3 w-3" /> Paste URL instead</>
                  )}
                </button>
              </div>

              {useUrlInput ? (
                <div className="space-y-1">
                  <Input
                    id="qrImageUrl"
                    placeholder="Paste direct image URL (PNG or JPG)..."
                    value={form.qrImageUrl}
                    onChange={(e) => { updateField('qrImageUrl', e.target.value); setFileName(''); }}
                  />
                  <p className="text-xs text-muted-foreground">The URL must point directly to an image file.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Drop zone / file picker */}
                  <label
                    htmlFor="qrFileInput"
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                      fileName
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-border hover:border-primary/50 hover:bg-muted/40'
                    }`}
                  >
                    {encodingFile ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : fileName ? (
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="max-w-[180px] truncate text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          {fileName}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            updateField('qrImageUrl', '');
                            setFileName('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="ml-1 rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-800"
                        >
                          <X className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground/60" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">Click to upload QR code</p>
                          <p className="text-xs text-muted-foreground">PNG or JPG · max 2 MB</p>
                        </div>
                      </>
                    )}
                  </label>
                  <input
                    ref={fileInputRef}
                    id="qrFileInput"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    The image is encoded and stored directly — no external hosting needed.
                  </p>
                </div>
              )}

              {form.qrImageUrl && <QrPreview url={form.qrImageUrl} />}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Show this payment option to customers</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => updateField('isActive', v)}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingOption ? 'Save Changes' : 'Add Payment Option'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Payment Option</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deletingOption?.label || deletingOption?.recipientName}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewOption?.type === 'e-wallet'
                ? <Wallet className="h-4 w-4" />
                : <CreditCard className="h-4 w-4" />}
              {previewOption?.label || previewOption?.type}
            </DialogTitle>
            <DialogDescription>
              Recipient: <strong>{previewOption?.recipientName}</strong>
              {previewOption?.accountDetails && (
                <> &nbsp;·&nbsp; {previewOption.accountDetails}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {previewOption && <FullQrImage url={previewOption.qrImageUrl} label={previewOption.label || previewOption.recipientName} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QrImageCell({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <QrCode className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="QR"
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function FullQrImage({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-64 w-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-xs">Image unavailable</p>
        </div>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      className="max-h-72 max-w-72 rounded-xl border border-border object-contain bg-white shadow-sm"
      onError={() => setFailed(true)}
    />
  );
}
