"use client";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E8E6E1] bg-white py-12 px-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6EDEF] text-[#7A1F2B] mb-3">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
      <p className="mt-0.5 max-w-xs text-xs text-[#6B6B67] leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
