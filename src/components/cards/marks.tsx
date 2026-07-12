/** FSSAI-style veg / non-veg marks and the Swiggy green rating badge. */

export function VegMark({ isVeg }: { isVeg?: boolean }) {
  if (isVeg === undefined) return null;
  return isVeg ? (
    <span className="veg-mark border-veg" title="Veg">
      <span className="h-1.5 w-1.5 rounded-full bg-veg" />
    </span>
  ) : (
    <span className="veg-mark border-nonveg" title="Non-veg">
      <span
        className="h-0 w-0 border-x-4 border-b-[7px] border-x-transparent border-b-nonveg"
        style={{ marginTop: 1 }}
      />
    </span>
  );
}

export function RatingBadge({ rating, count }: { rating: number; count?: string }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold">
      <span className="inline-flex items-center gap-0.5 rounded-md bg-rating px-1.5 py-0.5 text-xs font-bold text-white">
        ★ {rating.toFixed(1)}
      </span>
      {count ? <span className="text-xs font-normal text-slate2">({count})</span> : null}
    </span>
  );
}

export const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
