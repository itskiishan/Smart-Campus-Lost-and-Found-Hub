"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { LostItem } from "@/types/database";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import LocationFilters from "@/components/LocationFilters";
import ItemCard from "@/components/ItemCard";
import type { User } from "@supabase/supabase-js";

export default function Dashboard() {
  const [items, setItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All Locations");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("lost_items")
        .select("*")
        .or("moderation_status.eq.active,moderation_status.is.null")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setItems([]);
      } else {
        setItems(data ?? []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong while loading items"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim();

    return items.filter((item) => {
      const matchesLocation =
        location === "All Locations" || item.campus_location === location;

      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      return matchesLocation && matchesSearch;
    });
  }, [items, search, location]);

  const reportHref = user ? "/report" : "/login";

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <Header />

      {/* Compact SaaS Hero Section */}
      <section className="border-b border-[#E8E6E1] bg-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block text-[10px] font-bold text-[#6B6B67] uppercase tracking-widest mb-1.5">
            ABESEC CAMPUS
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#171717] sm:text-3xl lg:text-4xl">
            LOST SOMETHING? <span className="text-[#7A1F2B]">Let&apos;s get it back.</span>
          </h1>
          <p className="mt-2 text-xs text-[#6B6B67] sm:text-sm max-w-xl mx-auto leading-relaxed">
            Find lost belongings, report found items, and reconnect them with their owners across campus.
          </p>

          <div className="mt-5 flex items-center justify-center">
            <Link
              href={reportHref}
              className="rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
            >
              Report an item
            </Link>
          </div>

          {/* Prominent Product Search Input */}
          <div className="mt-6 w-full max-w-xl mx-auto">
            <SearchBar value={search} onChange={setSearch} />
          </div>
        </div>
      </section>

      {/* Main Feed Area */}
      <main id="feed" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Integrated Location Chips */}
        <div className="mb-4 rounded-xl border border-[#E8E6E1] bg-white p-3 shadow-2xs">
          <LocationFilters selected={location} onChange={setLocation} />
        </div>

        {/* Results Metadata & Refresh Bar */}
        <div className="mb-3.5 flex items-center justify-between border-b border-[#E8E6E1] pb-2.5">
          <p className="text-xs font-medium text-[#6B6B67]">
            {loading
              ? "Searching items..."
              : `${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} reported`}
          </p>
          <button
            onClick={fetchItems}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E6E1] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] transition hover:bg-[#FAFAF8] disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 text-[#6B6B67] ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-[#C94A4A]">
            Failed to load items: {error}
          </div>
        )}

        {/* Feed Grid / Skeletons / Empty State */}
        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-[#E8E6E1] bg-white p-3.5 space-y-3"
              >
                <div className="aspect-[16/10] w-full rounded-lg animate-shimmer" />
                <div className="h-3.5 w-3/4 rounded animate-shimmer" />
                <div className="h-3 w-1/2 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : error ? null : filteredItems.length === 0 ? (
          /* Wispr-style Minimal Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E6E1] bg-white py-12 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6EDEF] text-[#7A1F2B] mb-3">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[#171717]">
              No lost items found
            </h2>
            <p className="mt-0.5 max-w-xs text-xs text-[#6B6B67]">
              Nothing matches your search or filter. Be the first to report an item.
            </p>
            <Link
              href={reportHref}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
            >
              + Report an item
            </Link>
          </div>
        ) : (
          /* 3-Column Responsive SaaS Grid */
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item, idx) => (
              <ItemCard
                key={item.id}
                item={item}
                animationDelay={Math.min(idx * 30, 200)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Mobile Report Action */}
      <div className="fixed bottom-4 right-4 sm:hidden z-30">
        <Link
          href={reportHref}
          className="flex items-center gap-1.5 rounded-full bg-[#7A1F2B] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Report
        </Link>
      </div>
    </div>
  );
}
