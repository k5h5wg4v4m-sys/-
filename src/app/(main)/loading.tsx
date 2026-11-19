import { ListingGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-[52px] w-full" />
      <ListingGridSkeleton count={4} />
    </div>
  );
}
