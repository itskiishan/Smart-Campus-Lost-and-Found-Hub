"use client";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Unable to load data",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-xs text-[#C94A4A] space-y-2">
      <div className="flex items-center gap-2 font-bold text-sm">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        {title}
      </div>
      <p className="text-[#171717]">{message}</p>
      {onRetry && (
        <div className="pt-1">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#C94A4A] transition hover:bg-red-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Retry Request
          </button>
        </div>
      )}
    </div>
  );
}
