"use client";

import Link from "next/link";

interface AdminHeaderProps {
  sectionTitle: string;
  onMobileMenuToggle: () => void;
}

export default function AdminHeader({
  sectionTitle,
  onMobileMenuToggle,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E8E6E1] bg-[#FAFAF8]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="rounded-lg p-1.5 text-[#6B6B67] hover:bg-white hover:text-[#171717] lg:hidden border border-[#E8E6E1]"
          aria-label="Toggle navigation drawer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div>
          <span className="text-[10px] font-bold text-[#7A1F2B] uppercase tracking-wider block leading-none">
            ABESEC Lost &amp; Found Admin Portal
          </span>
          <h1 className="text-sm font-bold text-[#171717] sm:text-base leading-tight mt-0.5">
            {sectionTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] shadow-2xs hover:bg-[#FAFAF8]"
        >
          Student Portal
        </Link>
      </div>
    </header>
  );
}
