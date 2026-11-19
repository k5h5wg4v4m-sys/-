import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-2xl bg-[linear-gradient(90deg,var(--card)_25%,var(--border)_50%,var(--card)_75%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}
