"use client";

interface StatusBadgeProps {
  status: string;
  type?: "item" | "moderation" | "claim" | "handover" | "custody" | "role";
}

const BADGE_STYLES: Record<string, string> = {
  // Item lifecycle
  lost: "bg-red-50 text-[#C94A4A] border-red-200/60",
  found: "bg-emerald-50 text-[#4F7C68] border-emerald-200/60",
  claimed: "bg-amber-50 text-[#B88A3B] border-amber-200/60",
  returned: "bg-emerald-50 text-[#4F7C68] border-emerald-200/60",

  // Moderation status
  active: "bg-gray-100 text-gray-700 border-gray-200",
  flagged: "bg-amber-100 text-amber-800 border-amber-300",
  removed: "bg-red-100 text-red-800 border-red-300",

  // Claim status
  pending: "bg-blue-50 text-blue-700 border-blue-200/60",
  approved: "bg-emerald-50 text-[#4F7C68] border-emerald-200/60",
  rejected: "bg-red-50 text-[#C94A4A] border-red-200/60",

  // Handover status
  completed: "bg-emerald-50 text-[#4F7C68] border-emerald-200/60",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  expired: "bg-red-50 text-[#C94A4A] border-red-200/60",

  // Custody status
  received: "bg-[#F6EDEF] text-[#7A1F2B] border-[#7A1F2B]/20",
  in_vault: "bg-amber-50 text-[#B88A3B] border-amber-200/60",
  released: "bg-emerald-50 text-[#4F7C68] border-emerald-200/60",

  // Roles
  student: "bg-gray-100 text-gray-700 border-gray-200",
  admin: "bg-[#F6EDEF] text-[#7A1F2B] border-[#7A1F2B]/20",
  super_admin: "bg-[#7A1F2B] text-white border-[#7A1F2B]",
};

export default function StatusBadge({ status, type = "item" }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const style = BADGE_STYLES[normalized] || "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
