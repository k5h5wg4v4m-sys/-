import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";

/**
 * Карточка объявления (Premium Green). Данные приходят из базы (public.search_listings);
 * кнопка избранного передаётся слотом, чтобы она выполняла реальное действие.
 */
export type ListingCardData = {
  id: string;
  title: string;
  priceLabel: string;
  location: string;
  dateLabel: string;
  imageUrl: string | null;
};

export function ListingCard({ item, favoriteSlot }: { item: ListingCardData; favoriteSlot?: React.ReactNode }) {
  return (
    <article className="group relative flex animate-rise flex-col">
      <Link href={`/listing/${item.id}`} className="relative block aspect-[4/5] overflow-hidden rounded-3xl bg-card">
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </Link>
      {favoriteSlot && <div className="absolute top-2.5 right-2.5">{favoriteSlot}</div>}
      <div className="mt-2.5 flex flex-col gap-0.5 px-0.5">
        <p className="text-[17px] font-extrabold text-primary">{item.priceLabel}</p>
        <Link href={`/listing/${item.id}`} className="line-clamp-2 text-[14.5px] leading-snug font-medium text-text">
          {item.title}
        </Link>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{item.location}</span>
        </p>
        <p className="text-xs text-muted">{item.dateLabel}</p>
      </div>
    </article>
  );
}
