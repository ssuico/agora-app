import { useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, MessageSquare, ShoppingBag, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface ProductInfo {
  _id: string;
  name: string;
  images: string[];
  sellingPrice: number;
  discountPrice?: number | null;
  storeId: string;
}

interface ExistingRating {
  stars: number;
  comment: string;
  ratedAt?: string;
}

interface ProductRatingPageProps {
  productId: string;
  product: ProductInfo;
  isEligible: boolean;
  existingRating: ExistingRating | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Star
              className={`h-10 w-10 transition-colors ${
                s <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-sm font-medium text-muted-foreground h-5">
        {LABELS[hovered || value] ?? ''}
      </p>
    </div>
  );
}

export function ProductRatingPage({ productId, product, isEligible, existingRating }: ProductRatingPageProps) {
  // currentRating is the live copy — updated immediately after each successful submit
  const [currentRating, setCurrentRating] = useState<ExistingRating | null>(existingRating);
  const [stars, setStars] = useState(existingRating?.stars ?? 5);
  const [comment, setComment] = useState(existingRating?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [imgError, setImgError] = useState(false);

  const effectivePrice =
    typeof product.discountPrice === 'number' && product.discountPrice < product.sellingPrice
      ? product.discountPrice
      : product.sellingPrice;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratings: [
            {
              productId,
              stars,
              comment: comment.trim() || undefined,
              type: 'product',
            },
          ],
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to submit rating');
        return;
      }

      const updatedRating: ExistingRating = {
        stars,
        comment: comment.trim(),
        ratedAt: new Date().toISOString(),
      };
      setCurrentRating(updatedRating);
      setSubmitted(true);
      toast.success(currentRating ? 'Rating updated!' : 'Thank you for your feedback!');
    } catch {
      toast.error('Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => history.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Product card */}
      <div className="rounded-xl border bg-card p-4 flex gap-4 items-center">
        <div className="h-20 w-20 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {product.images.length > 0 && !imgError ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
          )}
        </div>
        <div>
          <h2 className="font-semibold text-base leading-snug">{product.name}</h2>
          <p className="mt-0.5 text-sm text-primary font-medium">{fmt(effectivePrice)}</p>
        </div>
      </div>

      {/* Current rating card — updates immediately after submit */}
      {currentRating && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Current Rating</h3>
            {currentRating.ratedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(currentRating.ratedAt).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-5 w-5 ${s <= currentRating.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`}
                />
              ))}
            </span>
            <span className="text-sm font-semibold">{currentRating.stars}/5</span>
            <span className="text-xs text-muted-foreground">· {LABELS[currentRating.stars]}</span>
          </div>
          {currentRating.comment ? (
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground">{currentRating.comment}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No comment left.</p>
          )}
        </div>
      )}

      {/* Not eligible */}
      {!isEligible && (
        <div className="rounded-xl border bg-muted/30 p-6 text-center space-y-3">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">Purchase required</p>
          <p className="text-sm text-muted-foreground">
            You can only rate products you have purchased or reserved.
          </p>
          <Button variant="outline" onClick={() => history.back()}>
            Go Back
          </Button>
        </div>
      )}

      {/* Eligible — success state */}
      {isEligible && submitted && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <p className="text-lg font-semibold">Rating saved!</p>
          <p className="text-sm text-muted-foreground">Your rating helps other customers decide.</p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => history.back()}>
              Go Back
            </Button>
            <Button
              onClick={() => {
                setSubmitted(false);
                // re-sync existing values so it's obvious the rating was saved
              }}
            >
              Edit Rating
            </Button>
          </div>
        </div>
      )}

      {/* Eligible — rating form */}
      {isEligible && !submitted && (
        <div className="rounded-xl border bg-card p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-center">
              {currentRating ? 'Update Your Rating' : 'Rate This Product'}
            </h3>
            {currentRating && (
              <p className="text-xs text-center text-muted-foreground mt-1">
                Submitting will overwrite your previous rating.
              </p>
            )}
          </div>

          <StarPicker value={stars} onChange={setStars} />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Comment <span className="font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this product..."
              maxLength={500}
              rows={4}
              className="w-full resize-none rounded-xl border bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-right text-xs text-muted-foreground">{comment.length}/500</p>
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {currentRating ? 'Update Rating' : 'Submit Rating'}
          </Button>
        </div>
      )}
    </div>
  );
}
