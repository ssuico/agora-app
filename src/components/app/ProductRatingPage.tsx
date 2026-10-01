import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleDollarSign,
  MessageSquare,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

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
              className={`size-11 transition-colors ${
                s <= (hovered || value) ? 'fill-rating text-rating' : 'text-muted-foreground/20'
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
      <Button
        type="button"
        variant="outline"
        onClick={() => history.back()}
        className="rounded-full font-semibold"
      >
        <ArrowLeft data-icon="inline-start" />
        Return to store
      </Button>

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-6">
          <Card className="gap-0 rounded-2xl py-4 sm:py-5">
            <CardContent className="px-4 sm:px-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {product.images.length > 0 && !imgError ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="size-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <ShoppingBag className="size-9 text-muted-foreground/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product to rate</p>
                  <h2 className="mt-1 text-xl font-semibold leading-tight">{product.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-base font-semibold text-foreground">{fmt(effectivePrice)}</span>
                    {hasDiscount && (
                      <span className="text-sm text-muted-foreground line-through">{fmt(product.sellingPrice)}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {currentRating && (
            <Card className="gap-3 rounded-2xl py-4 sm:py-5">
              <CardHeader className="px-4 sm:px-5">
                <CardTitle className="text-sm uppercase tracking-wide">Your current rating</CardTitle>
                {currentRating.ratedAt && (
                  <CardAction>
                    <CardDescription className="text-xs">
                      {new Date(currentRating.ratedAt).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </CardDescription>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3 px-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`size-5 ${s <= currentRating.stars ? 'fill-rating text-rating' : 'text-muted-foreground/20'}`}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-semibold">{currentRating.stars}/5</span>
                  <span className="text-xs text-muted-foreground">- {LABELS[currentRating.stars]}</span>
                </div>
                {currentRating.comment ? (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                    <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <p className="text-sm text-foreground">{currentRating.comment}</p>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground">No comment left.</p>
                )}
              </CardContent>
            </Card>
          )}

          {!isEligible && (
            <Empty className="rounded-2xl border bg-muted/30">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBag />
                </EmptyMedia>
                <EmptyTitle className="text-base">Purchase required</EmptyTitle>
                <EmptyDescription>
                  You can only rate products you have purchased or reserved.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => history.back()}>
                  Go back
                </Button>
              </EmptyContent>
            </Empty>
          )}

          {isEligible && submitted && (
            <Empty className="rounded-2xl border bg-card p-8">
              <EmptyHeader>
                <EmptyMedia>
                  <CheckCircle className="size-12 text-success" />
                </EmptyMedia>
                <EmptyTitle>Rating saved</EmptyTitle>
                <EmptyDescription>Your review is now included in customer feedback.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => history.back()}>
                    Back to previous page
                  </Button>
                  <Button onClick={() => setSubmitted(false)}>Edit rating</Button>
                </div>
              </EmptyContent>
            </Empty>
          )}

          {isEligible && !submitted && (
            <Card className="rounded-2xl py-5 sm:py-6">
              <CardHeader className="px-5 text-center sm:px-6">
                <CardTitle className="text-lg">{currentRating ? 'Update your rating' : 'Rate this product'}</CardTitle>
                <CardDescription>
                  {currentRating
                    ? 'Submitting will overwrite your previous rating.'
                    : 'Your feedback helps other customers choose better.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-6 px-5 sm:px-6">
                <StarPicker value={stars} onChange={setStars} />

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-rating-comment" className="text-muted-foreground">
                    Comment <span className="font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="product-rating-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience with this product..."
                    maxLength={500}
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-right text-xs text-muted-foreground">{comment.length}/500</p>
                </div>
              </CardContent>

              <CardFooter className="px-5 sm:px-6">
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Spinner data-icon="inline-start" />}
                  {currentRating ? 'Update rating' : 'Submit rating'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="gap-3 rounded-2xl py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CircleDollarSign className="size-4 text-muted-foreground" />
                Quick summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Current price</span>
                <span className="font-medium">{fmt(effectivePrice)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Rating status</span>
                <Badge variant={isEligible ? 'success' : 'warning'}>
                  {isEligible ? 'Eligible' : 'Not eligible'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Your score</span>
                <span className="font-medium">{currentRating ? `${currentRating.stars}/5` : 'Not rated yet'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 rounded-2xl py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-muted-foreground" />
                Helpful review tips
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {RATING_TIPS.map((tip) => (
                  <li key={tip} className="rounded-lg bg-muted/30 px-3 py-2 leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-muted/20 py-4 shadow-none">
            <CardContent className="px-4 text-xs leading-relaxed text-muted-foreground">
              Reviews should reflect your real product experience. Avoid sharing private information in comments.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
