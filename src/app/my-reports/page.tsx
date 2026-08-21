"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { LostItem } from "@/types/database";
import Header from "@/components/Header";
import ItemCard from "@/components/ItemCard";
import type { User } from "@supabase/supabase-js";

type TypeFilter = "all" | "lost" | "found" | "claimed" | "returned";

const FILTER_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "lost", label: "Lost" },
  { key: "found", label: "Found" },
  { key: "claimed", label: "Claimed" },
  { key: "returned", label: "Returned" },
];

export default function MyReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);
    });
  }, [router]);

  const fetchMyReports = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await (supabase
        .from("lost_items") as any)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        setItems([]);
      } else {
        setItems((data as LostItem[]) ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your reports.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchMyReports(user.id);
    }
  }, [user, fetchMyReports]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter === "all") return true;
      if (typeFilter === "lost") return item.item_type === "lost" && item.status === "lost";
      if (typeFilter === "found") return item.item_type === "found" && item.status === "found";
      if (typeFilter === "claimed") return item.status === "claimed";
      if (typeFilter === "returned") return item.status === "returned";
      return true;
    });
  }, [items, typeFilter]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#171717]">My Reports</h1>
            <p className="mt-0.5 text-xs text-[#6B6B67]">Reports you have submitted to the campus hub.</p>
          </div>
          <Link
            href="/report"
            className="rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
          >
            + New Report
          </Link>
        </div>

        <div className="mb-4 rounded-xl border border-[#E8E6E1] bg-white px-3 py-2.5 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter your reports">
            {FILTER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={typeFilter === key}
                onClick={() => setTypeFilter(key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ${
                  typeFilter === key
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
            {filteredItems.length} report{filteredItems.length !== 1 ? "s" : ""}
          </p>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-[#C94A4A]">
            Failed to load reports: {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-[#E8E6E1] bg-white p-3.5 space-y-3">
                <div className="aspect-[16/10] w-full rounded-lg animate-shimmer" />
                <div className="h-3.5 w-3/4 rounded animate-shimmer" />
                <div className="h-3 w-1/2 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E6E1] bg-white py-12 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6EDEF] text-[#7A1F2B] mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[#171717]">No reports found</h2>
            <p className="mt-0.5 max-w-xs text-xs text-[#6B6B67]">
              {typeFilter === "all" ? "You have not submitted any reports yet." : `No ${typeFilter} reports to show.`}
            </p>
            <Link
              href="/report"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
            >
              + Report an item
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item, idx) => (
              <ItemCard key={item.id} item={item} animationDelay={Math.min(idx * 30, 200)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
