import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import {
  AlertCircle,
  CreditCard,
  Eye,
  ImageIcon,
  Link,
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
    <Card className="items-center gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>QR Preview</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="relative flex size-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
          {status === 'loading' && (
            <Skeleton className="absolute inset-0 flex items-center justify-center rounded-none">
              <QrCode className="size-10 text-muted-foreground/30" />
            </Skeleton>
          )}
          {status === 'error' && (
            <Empty className="absolute inset-0 justify-center gap-0 rounded-none bg-muted/60 p-0 md:p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ImageIcon />
                </EmptyMedia>
                <EmptyDescription>Unable to load image</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <img
            src={url}
            alt="QR preview"
            className={`size-full object-contain transition-opacity ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        </div>
      </CardContent>
      {status === 'loaded' && (
        <CardFooter className="px-4">
          <Badge variant="success">Image loaded successfully</Badge>
        </CardFooter>
      )}
    </Card>
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Options</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage QR codes and payment methods for your store.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Add Payment Option
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>QR Code</TableHead>
              <TableHead>Label / Type</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Account Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="size-16 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-20 rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8">
                  <Empty className="md:p-6">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <QrCode />
                      </EmptyMedia>
                      <EmptyTitle>No payment options yet.</EmptyTitle>
                      <EmptyDescription>Click "Add Payment Option" to get started.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((option) => (
                <TableRow key={option._id}>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openPreview(option)}
                      className="group relative size-16 overflow-hidden rounded-lg bg-white p-0 hover:bg-white hover:ring-2 hover:ring-primary/40"
                      title="Click to view full QR code"
                    >
                      <QrImageCell url={option.qrImageUrl} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                        <Eye className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </div>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{option.label || '—'}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {option.type === 'e-wallet'
                        ? <Wallet className="size-3 text-muted-foreground" />
                        : <CreditCard className="size-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground capitalize">{option.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{option.recipientName}</TableCell>
                  <TableCell className="text-muted-foreground">{option.accountDetails || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={option.isActive ? 'success' : 'secondary'}>
                      {option.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(option)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDelete(option)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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

          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-4">
            {/* Type */}
            <Field className="gap-2">
              <FieldLabel htmlFor="type">Type</FieldLabel>
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as PaymentOptionType)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="e-wallet">
                      <span className="flex items-center gap-2">
                        <Wallet className="size-4" /> E-Wallet
                      </span>
                    </SelectItem>
                    <SelectItem value="bank">
                      <span className="flex items-center gap-2">
                        <CreditCard className="size-4" /> Bank
                      </span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {/* Label */}
            <Field className="gap-2">
              <FieldLabel htmlFor="label">
                Label <span className="text-muted-foreground text-xs">(optional — e.g. GCash, BPI)</span>
              </FieldLabel>
              <Input
                id="label"
                placeholder="e.g. GCash, BPI Savings"
                value={form.label}
                onChange={(e) => updateField('label', e.target.value)}
              />
            </Field>

            {/* Recipient Name */}
            <Field className="gap-2">
              <FieldLabel htmlFor="recipientName">Recipient Name <span className="text-destructive">*</span></FieldLabel>
              <Input
                id="recipientName"
                placeholder="e.g. Juan Dela Cruz"
                value={form.recipientName}
                onChange={(e) => updateField('recipientName', e.target.value)}
                required
              />
            </Field>

            {/* Account Details */}
            <Field className="gap-2">
              <FieldLabel htmlFor="accountDetails">
                Account Details <span className="text-muted-foreground text-xs">(optional — masked ok)</span>
              </FieldLabel>
              <Input
                id="accountDetails"
                placeholder="e.g. 09XX-XXX-9876"
                value={form.accountDetails}
                onChange={(e) => updateField('accountDetails', e.target.value)}
              />
            </Field>

            {/* QR Image */}
            <Field className="gap-2">
              <div className="flex items-center justify-between">
                <FieldLabel>
                  QR Code Image <span className="text-destructive">*</span>
                </FieldLabel>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setUseUrlInput((v) => !v);
                    updateField('qrImageUrl', '');
                    setFileName('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  {useUrlInput ? (
                    <><Upload data-icon="inline-start" /> Upload file instead</>
                  ) : (
                    <><Link data-icon="inline-start" /> Paste URL instead</>
                  )}
                </Button>
              </div>

              {useUrlInput ? (
                <div className="flex flex-col gap-1">
                  <Input
                    id="qrImageUrl"
                    placeholder="Paste direct image URL (PNG or JPG)..."
                    value={form.qrImageUrl}
                    onChange={(e) => { updateField('qrImageUrl', e.target.value); setFileName(''); }}
                  />
                  <FieldDescription>The URL must point directly to an image file.</FieldDescription>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Drop zone / file picker */}
                  <label
                    htmlFor="qrFileInput"
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                      fileName
                        ? 'border-success bg-success-soft'
                        : 'border-input hover:border-ring hover:bg-muted'
                    }`}
                  >
                    {encodingFile ? (
                      <Spinner className="size-6 text-muted-foreground" />
                    ) : fileName ? (
                      <div className="flex items-center gap-2">
                        <QrCode className="size-5 text-success shrink-0" />
                        <span className="max-w-45 truncate text-sm font-medium text-success-ink">
                          {fileName}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            updateField('qrImageUrl', '');
                            setFileName('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="size-6 text-muted-foreground/60" />
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
                  <FieldDescription>
                    The image is encoded and stored directly — no external hosting needed.
                  </FieldDescription>
                </div>
              )}

              {form.qrImageUrl && <QrPreview url={form.qrImageUrl} />}
            </Field>

            {/* Active toggle */}
            <Field orientation="horizontal" className="justify-between rounded-lg border border-border/60 px-4 py-3">
              <FieldContent>
                <FieldLabel htmlFor="isActive">Active</FieldLabel>
                <FieldDescription>Show this payment option to customers</FieldDescription>
              </FieldContent>
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => updateField('isActive', v)}
              />
            </Field>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner data-icon="inline-start" />}
                {editingOption ? 'Save Changes' : 'Add Payment Option'}
              </Button>
            </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Option</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deletingOption?.label || deletingOption?.recipientName}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewOption?.type === 'e-wallet'
                ? <Wallet className="size-4" />
                : <CreditCard className="size-4" />}
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
      <div className="flex size-full items-center justify-center bg-muted">
        <QrCode className="size-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="QR"
      className="size-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function FullQrImage({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Empty className="size-64 flex-none justify-center border p-0 md:p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageIcon />
          </EmptyMedia>
          <EmptyDescription>Image unavailable</EmptyDescription>
        </EmptyHeader>
      </Empty>
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
