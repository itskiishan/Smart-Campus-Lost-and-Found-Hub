import Link from "next/link";
import type { LostItem } from "@/types/database";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  lost: {
    label: "LOST",
    bg: "bg-red-50",
    text: "text-[#C94A4A]",
    border: "border-red-200/60",
  },
  found: {
    label: "FOUND",
    bg: "bg-emerald-50",
    text: "text-[#4F7C68]",
    border: "border-emerald-200/60",
  },
  claimed: {
    label: "CLAIMED",
    bg: "bg-amber-50",
    text: "text-[#B88A3B]",
    border: "border-amber-200/60",
  },
  returned: {
    label: "RETURNED",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200/60",
  },
};

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "JUST NOW";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}M AGO`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}H AGO`;
  if (diffInSeconds < 172800) return "YESTERDAY";
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}D AGO`;

  return date
    .toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}

interface ItemCardProps {
  item: LostItem;
  animationDelay?: number;
}

export default function ItemCard({ item, animationDelay = 0 }: ItemCardProps) {
  const status = STATUS_CONFIG[item.status] ?? {
    label: item.status.toUpperCase(),
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  };

  const relativeTime = getRelativeTime(item.created_at);

  return (
    <Link href={`/item/${item.id}`} className="block focus:outline-none">
      <article
        style={{ animationDelay: `${animationDelay}ms` }}
        className="group animate-fade-in flex flex-col overflow-hidden rounded-xl border border-[#E8E6E1] bg-white transition duration-150 hover:-translate-y-0.5 hover:border-[#7A1F2B]/30 hover:shadow-xs"
      >
        {/* Item Image Container */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#FAFAF8]">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#6B6B67]">
              <svg
                className="h-8 w-8 opacity-30"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
          )}

          {/* Refined Status Pill */}
          <span
            className={`absolute left-2.5 top-2.5 rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${status.bg} ${status.text} ${status.border}`}
          >
            {status.label}
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-3.5">
          {/* Metadata */}
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-[#6B6B67] uppercase mb-1">
            <span className="truncate max-w-[70%]">{item.campus_location}</span>
            <span className="shrink-0">{relativeTime}</span>
          </div>

          {/* Title */}
          <h3 className="truncate text-sm font-bold text-[#171717] group-hover:text-[#7A1F2B] transition-colors duration-150">
            {item.title}
          </h3>

          {/* Short Description */}
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-[#6B6B67] leading-relaxed">
              {item.description}
            </p>
          ) : (
            <p className="mt-1 text-xs italic text-[#6B6B67]/60">
              No description provided.
            </p>
          )}

          {/* Footer Tag */}
          <div className="mt-auto pt-2.5 flex items-center justify-between">
            <span className="rounded border border-[#E8E6E1] bg-[#FAFAF8] px-2 py-0.5 text-[10px] font-medium text-[#171717]">
              {item.category}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
