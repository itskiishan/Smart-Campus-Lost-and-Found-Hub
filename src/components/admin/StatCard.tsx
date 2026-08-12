"use client";

import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  href?: string;
  valueColor?: string;
}

export default function StatCard({
  label,
  value,
  subtext,
  href,
  valueColor = "text-[#171717]",
}: StatCardProps) {
  const content = (
    <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-2xs transition hover:border-[#7A1F2B]/30 hover:shadow-2xs">
      <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">
        {label}
      </span>
      <span className={`text-2xl font-extrabold ${valueColor}`}>
        {value}
      </span>
      {subtext && (
        <span className="text-[10px] text-[#6B6B67] block mt-1">
          {subtext}
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
