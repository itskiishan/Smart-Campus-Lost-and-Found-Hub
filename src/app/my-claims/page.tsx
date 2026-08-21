"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ClaimRow, LostItem } from "@/types/database";
import Header from "@/components/Header";
import type { User } from "@supabase/supabase-js";

type ClaimFilter = "all" | "pending" | "approved" | "rejected";

const FILTER_OPTIONS: { key: ClaimFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

interface ClaimWithItem extends ClaimRow {
  targetItem: LostItem | null;
}

const CLAIM_STATUS_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: "PENDING", bg: "bg-amber-50", text: "text-[#B88A3B]", border: "border-amber-200/60" },
  approved: { label: "APPROVED", bg: "bg-emerald-50", text: "text-[#4F7C68]", border: "border-emerald-200/60" },
  rejected: { label: "REJECTED", bg: "bg-red-50", text: "text-[#C94A4A]", border: "border-red-200/60" },
};

const ITEM_TYPE_STYLE = {
  lost: { label: "LOST REPORT", bg: "bg-red-50", text: "text-[#C94A4A]", border: "border-red-200/60" },
  found: { label: "FOUND REPORT", bg: "bg-emerald-50", text: "text-[#4F7C68]", border: "border-emerald-200/60" },
};

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffS = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffS < 60) return "just now";
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  if (diffS < 604800) return `${Math.floor(diffS / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function MyClaimsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<ClaimWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);
    });
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadClaims() {
      setLoading(true);
      setError(null);
      try {
        // Fetch claims made by this user
        const { data: claimsData, error: claimsErr } = await (supabase
          .from("claims") as any)
          .select("*")
          .eq("claimant_id", user!.id)
          .order("created_at", { ascending: false });

        if (claimsErr) {
          setError(claimsErr.message);
          setClaims([]);
          return;
        }

        const rawClaims = (claimsData as ClaimRow[]) ?? [];

        // For each claim, fetch the target item details
        const itemIds = [...new Set(rawClaims.map((c) => c.lost_item_id))];

        let itemMap: Record<string, LostItem> = {};
        if (itemIds.length > 0) {
          const { data: itemsData } = await (supabase
            .from("lost_items") as any)
            .select("id, title, item_type, status, campus_location, image_url, category, created_at")
            .in("id", itemIds);

          if (itemsData && Array.isArray(itemsData)) {
            itemMap = Object.fromEntries(
              (itemsData as LostItem[]).map((i) => [i.id, i])
            );
          }
        }

        const enriched: ClaimWithItem[] = rawClaims.map((c) => ({
          ...c,
          targetItem: itemMap[c.lost_item_id] ?? null,
        }));

        setClaims(enriched);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load your claims.");
        setClaims([]);
      } finally {
        setLoading(false);
      }
    }

    loadClaims();
  }, [user]);

  const filteredClaims = useMemo(() => {
    if (claimFilter === "all") return claims;
    return claims.filter((c) => c.status === claimFilter);
  }, [claims, claimFilter]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-lg font-extrabold tracking-tight text-[#171717]">My Claims</h1>
          <p className="mt-0.5 text-xs text-[#6B6B67]">Claims you have submitted on campus reports.</p>
        </div>

        {/* Filter chips */}
        <div className="mb-4 rounded-xl border border-[#E8E6E1] bg-white px-3 py-2.5 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter your claims">
            {FILTER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={claimFilter === key}
                onClick={() => setClaimFilter(key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ${
                  claimFilter === key
                    ? "bg-[#7A1F2B] text-white shadow-2xs"
                    : "border border-[#E8E6E1] bg-white text-[#171717] hover:border-[#7A1F2B]/30 hover:bg-[#FAFAF8]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!loading && !error && (
          <p className="mb-3 text-xs font-medium text-[#6B6B67]">
            {filteredClaims.length} claim{filteredClaims.length !== 1 ? "s" : ""}
          </p>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-[#C94A4A]">
            Failed to load claims: {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#E8E6E1] bg-white p-4 space-y-2">
                <div className="h-4 w-1/2 rounded animate-shimmer" />
                <div className="h-3 w-1/3 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E6E1] bg-white py-12 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6EDEF] text-[#7A1F2B] mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[#171717]">No claims found</h2>
            <p className="mt-0.5 max-w-xs text-xs text-[#6B6B67]">
              {claimFilter === "all"
                ? "You have not submitted any claims yet. Browse the feed to find your items."
                : `No ${claimFilter} claims to show.`}
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
            >
              Browse Reports
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClaims.map((claim) => {
              const item = claim.targetItem;
              const claimStyle = CLAIM_STATUS_STYLE[claim.status] ?? {
                label: claim.status.toUpperCase(),
                bg: "bg-gray-100",
                text: "text-gray-700",
                border: "border-gray-200",
              };
              const itemTypeStyle =
                item?.item_type === "found" ? ITEM_TYPE_STYLE.found : ITEM_TYPE_STYLE.lost;

              // Show COMPLETED if claim is approved and item is returned
              const isCompleted =
                claim.status === "approved" && item?.status === "returned";

              return (
                <div
                  key={claim.id}
                  className="flex items-start gap-3.5 rounded-xl border border-[#E8E6E1] bg-white p-4 transition hover:border-[#7A1F2B]/20 hover:shadow-xs"
                >
                  {/* Thumbnail */}
                  <div className="shrink-0 h-14 w-14 overflow-hidden rounded-lg border border-[#E8E6E1] bg-[#FAFAF8] flex items-center justify-center">
                    {item?.image_url ? (
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <svg className="h-6 w-6 text-[#6B6B67] opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {/* Report type badge */}
                      <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${itemTypeStyle.bg} ${itemTypeStyle.text} ${itemTypeStyle.border}`}>
                        {itemTypeStyle.label}
                      </span>
                      {/* Claim status badge */}
                      <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${claimStyle.bg} ${claimStyle.text} ${claimStyle.border}`}>
                        {claimStyle.label}
                      </span>
                      {/* Completed overlay badge */}
                      {isCompleted && (
                        <span className="rounded-md border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase text-blue-700">
                          RETURNED
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-bold text-[#171717] truncate">
                      {item?.title ?? "Item no longer available"}
                    </p>

                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#6B6B67]">
                      {item?.campus_location && (
                        <span className="truncate">{item.campus_location}</span>
                      )}
                      <span className="shrink-0">{getRelativeTime(claim.created_at)}</span>
                    </div>
                  </div>

                  {/* Action: view item */}
                  {claim.status === "approved" && (
                    <Link
                      href={`/item/${claim.lost_item_id}`}
                      className="shrink-0 self-center rounded-lg border border-[#7A1F2B]/30 px-2.5 py-1.5 text-[10px] font-semibold text-[#7A1F2B] transition hover:bg-[#F6EDEF]"
                    >
                      View ?
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
