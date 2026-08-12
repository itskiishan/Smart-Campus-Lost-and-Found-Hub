"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface MatchCandidate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  campus_location: string;
  image_url: string | null;
  item_type: "lost" | "found";
  status: string;
  incident_at: string | null;
  match_score: number;
  breakdown: {
    text_similarity: number | null;
    image_similarity: number | null;
    location_similarity: number | null;
    time_similarity: number | null;
  };
}

interface AIMatchSuggestionsProps {
  itemId: string;
}

export function AIMatchSuggestions({ itemId }: AIMatchSuggestionsProps) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [targetType, setTargetType] = useState<"lost" | "found" | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchMatches() {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const res = await fetch(`/api/match?itemId=${encodeURIComponent(itemId)}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          if (isMounted) setLoading(false);
          return;
        }

        const data = await res.json();

        if (isMounted && data.success) {
          setMatches(data.matches || []);
          setTargetType(data.targetItemType || null);
        }
      } catch (err) {
        console.warn("Non-blocking AI match fetch notice:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (itemId) {
      fetchMatches();
    }

    return () => {
      isMounted = false;
    };
  }, [itemId]);

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl bg-slate-900/60 border border-slate-800 p-6 backdrop-blur-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 rounded-full bg-blue-500/30" />
          <div className="h-5 w-48 bg-slate-800 rounded" />
        </div>
        <div className="h-24 bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  if (matches.length === 0) {
    return null;
  }

  const oppositeLabel = targetType === "lost" ? "FOUND" : "LOST";

  return (
    <div className="mt-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-blue-500/20 p-6 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white tracking-wide">
              AI Match Suggestions
            </h3>
            <p className="text-xs text-slate-400">
              Smart candidate recommendations matching this report based on description, location, time, and visual features.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {matches.length} Candidate{matches.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Matches List */}
      <div className="space-y-4">
        {matches.map((m) => (
          <div
            key={m.id}
            className="group relative flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-blue-500/40 transition-all duration-200"
          >
            {/* Image Thumbnail */}
            <div className="sm:w-28 sm:h-28 w-full h-40 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/50 shrink-0 relative">
              {m.image_url ? (
                <img
                  src={m.image_url}
                  alt={m.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-2 text-center">
                  <svg
                    className="w-8 h-8 mb-1 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-[10px]">No Photo</span>
                </div>
              )}

              {/* Match Score Badge */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500/90 text-white font-bold text-xs shadow-md backdrop-blur-md">
                {m.match_score}% Match
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    {oppositeLabel} ITEM
                  </span>
                  <span className="text-xs text-slate-400">• {m.category}</span>
                </div>

                <h4 className="text-base font-medium text-white group-hover:text-blue-400 transition-colors">
                  {m.title}
                </h4>

                {m.description && (
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                    {m.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{m.campus_location}</span>
                  </div>

                  {m.incident_at && (
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{new Date(m.incident_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Match Signal Breakdown */}
              <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {m.breakdown.text_similarity !== null && (
                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/30">
                      Description {m.breakdown.text_similarity}%
                    </span>
                  )}
                  {m.breakdown.image_similarity !== null && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Visual {m.breakdown.image_similarity}%
                    </span>
                  )}
                  {m.breakdown.location_similarity !== null && (
                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/30">
                      Location {m.breakdown.location_similarity}%
                    </span>
                  )}
                  {m.breakdown.time_similarity !== null && (
                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/30">
                      Time {m.breakdown.time_similarity}%
                    </span>
                  )}
                </div>

                <Link
                  href={`/item/${m.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors ml-auto shadow-sm"
                >
                  <span>View Candidate Item</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
