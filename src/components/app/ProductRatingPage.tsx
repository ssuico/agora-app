import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleDollarSign,
  Loader2,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react';
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

const RATING_TIPS = [
  'Check freshness, flavor, and overall quality.',
  'Mention what you liked most or what can improve.',
  'Keep comments short and clear to help other buyers.',
];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
          >
            <Star
              className={`h-11 w-11 transition-colors ${
                s <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="h-5 text-sm font-medium text-muted-foreground">{LABELS[hovered || value] ?? ''}</p>
    </div>
  );
}

export function ProductRatingPage({ productId, product, isEligible, existingRating }: ProductRatingPageProps) {
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

  const hasDiscount =
    typeof product.discountPrice === 'number' && product.discountPrice < product.sellingPrice;

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
    <div className="mx-auto w-full max-w-6xl px-2 py-4 sm:px-4 sm:py-8">
      <button
        type="button"
        onClick={() => history.back()}
        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to store
      </button>

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
                {product.images.length > 0 && !imgError ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <ShoppingBag className="h-9 w-9 text-muted-foreground/30" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product to rate</p>
                <h2 className="mt-1 text-xl font-semibold leading-tight">{product.name}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold text-primary">{fmt(effectivePrice)}</span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">{fmt(product.sellingPrice)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {currentRating && (
            <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your current rating</h3>
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-5 w-5 ${s <= currentRating.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`}
                    />
                  ))}
                </span>
                <span className="text-sm font-semibold">{currentRating.stars}/5</span>
                <span className="text-xs text-muted-foreground">- {LABELS[currentRating.stars]}</span>
              </div>
              {currentRating.comment ? (
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-foreground">{currentRating.comment}</p>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">No comment left.</p>
              )}
            </div>
          )}

          {!isEligible && (
            <div className="rounded-2xl border bg-muted/30 p-6 text-center space-y-3">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">Purchase required</p>
              <p className="text-sm text-muted-foreground">
                You can only rate products you have purchased or reserved.
              </p>
              <Button variant="outline" onClick={() => history.back()}>
                Go back
              </Button>
            </div>
          )}

          {isEligible && submitted && (
            <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold">Rating saved</p>
              <p className="text-sm text-muted-foreground">Your review is now included in customer feedback.</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button variant="outline" onClick={() => history.back()}>
                  Back to previous page
                </Button>
                <Button onClick={() => setSubmitted(false)}>Edit rating</Button>
              </div>
            </div>
          )}

          {isEligible && !submitted && (
            <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold">{currentRating ? 'Update your rating' : 'Rate this product'}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentRating
                    ? 'Submitting will overwrite your previous rating.'
                    : 'Your feedback helps other customers choose better.'}
                </p>
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
                  rows={5}
                  className="w-full resize-none rounded-xl border bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-right text-xs text-muted-foreground">{comment.length}/500</p>
              </div>

              <Button className="w-full gap-2" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {currentRating ? 'Update rating' : 'Submit rating'}
              </Button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Quick summary</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Current price</span>
                <span className="font-medium">{fmt(effectivePrice)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Rating status</span>
                <span className={`font-medium ${isEligible ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isEligible ? 'Eligible' : 'Not eligible'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Your score</span>
                <span className="font-medium">{currentRating ? `${currentRating.stars}/5` : 'Not rated yet'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Helpful review tips</p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {RATING_TIPS.map((tip) => (
                <li key={tip} className="rounded-lg bg-muted/30 px-3 py-2 leading-relaxed">
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
            Reviews should reflect your real product experience. Avoid sharing private information in comments.
          </div>
        </aside>
      </div>
    </div>
  );
}
