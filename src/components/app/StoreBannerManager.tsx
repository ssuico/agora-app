import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, ImageIcon, ImagePlus, Trash2, Upload } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

const BANNER_WIDTH = 1600;
const BANNER_HEIGHT = 400;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 650_000;
const QUALITY_STEPS = [0.82, 0.7, 0.55, 0.4];

interface StoreBannerManagerProps {
  storeId: string;
}

async function toBannerDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = BANNER_WIDTH;
    canvas.height = BANNER_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported in this browser.');

    const scale = Math.max(BANNER_WIDTH / bitmap.width, BANNER_HEIGHT / bitmap.height);
    const sw = BANNER_WIDTH / scale;
    const sh = BANNER_HEIGHT / scale;
    ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);

    for (const quality of QUALITY_STEPS) {
      let url = canvas.toDataURL('image/webp', quality);
      if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= MAX_DATA_URL_CHARS) return url;
    }
    throw new Error('That image is too detailed to compress. Try a simpler one.');
  } finally {
    bitmap.close();
  }
}

export function StoreBannerManager({ storeId }: StoreBannerManagerProps) {
  const [bannerUpdatedAt, setBannerUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stores/${storeId}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { bannerUpdatedAt?: string | null };
        if (!cancelled) setBannerUpdatedAt(data.bannerUpdatedAt ?? null);
      } catch {
        if (!cancelled) setError('Could not load the current banner.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const currentUrl = bannerUpdatedAt
    ? `/api/stores/${storeId}/banner?v=${new Date(bannerUpdatedAt).getTime()}`
    : null;
  const previewUrl = pending ?? (loadFailed ? null : currentUrl);
  const busy = processing || saving || removing;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('That file is over 15 MB. Choose a smaller image.');
      return;
    }

    setProcessing(true);
    try {
      setPending(await toBannerDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setProcessing(false);
    }
  };

  const saveBanner = async (bannerImage: string | null) => {
    const res = await fetch(`/api/stores/${storeId}/banner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bannerImage }),
    });
    const data = (await res.json()) as { message?: string; bannerUpdatedAt?: string | null };
    if (!res.ok) throw new Error(data.message ?? 'Could not update the banner.');
    return data.bannerUpdatedAt ?? null;
  };

  const handleSave = async () => {
    if (!pending) return;
    setSaving(true);
    setError('');
    try {
      setBannerUpdatedAt(await saveBanner(pending));
      setPending(null);
      setLoadFailed(false);
      toast.success('Banner updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the banner.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError('');
    try {
      await saveBanner(null);
      setBannerUpdatedAt(null);
      setPending(null);
      setConfirmRemove(false);
      toast.success('Banner removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the banner.');
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store banner</CardTitle>
        <CardDescription>
          Shown at the top of your shop page for customers. Wide images work best; the picture is
          cropped to the center at a 4:1 ratio.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="aspect-[4/1] w-full rounded-lg" />
        ) : (
          <div className="relative aspect-[4/1] w-full overflow-hidden rounded-lg border border-border bg-muted">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={pending ? 'New banner preview' : 'Current store banner'}
                className="size-full object-cover"
                onError={() => {
                  if (!pending) setLoadFailed(true);
                }}
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <ImageIcon className="size-7" aria-hidden="true" />
                <p className="text-sm">No banner yet</p>
              </div>
            )}
            {pending && (
              <span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-semibold text-background">
                Preview, not saved
              </span>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Banner image file"
          onChange={handleFile}
        />

        <div className="flex flex-wrap items-center gap-2">
          {pending ? (
            <>
              <Button onClick={handleSave} disabled={busy}>
                {saving ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                {saving ? 'Saving...' : 'Save banner'}
              </Button>
              <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                Choose another
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => fileInputRef.current?.click()} disabled={busy || loading}>
                {processing ? <Spinner data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
                {processing ? 'Preparing...' : currentUrl && !loadFailed ? 'Replace banner' : 'Upload banner'}
              </Button>
              {currentUrl && !loadFailed && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmRemove(true)}
                  disabled={busy}
                >
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove banner?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers will see your shop page without a banner. You can upload a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
            >
              {removing ? <><Spinner data-icon="inline-start" />Removing...</> : 'Remove banner'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
