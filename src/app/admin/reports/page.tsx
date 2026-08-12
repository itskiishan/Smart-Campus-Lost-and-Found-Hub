"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { LostItem } from "@/types/database";
import { ITEM_CATEGORIES, CAMPUS_LOCATIONS } from "@/lib/locations";
import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [moderationFilter, setModerationFilter] = useState("");
  const [page, setPage] = useState(1);

  // Selected Report for Drawer/Modal
  const [selectedReport, setSelectedReport] = useState<LostItem | null>(null);

  // Moderation Dialog State
  const [actionTarget, setActionTarget] = useState<{
    item: LostItem;
    action: "flag" | "remove" | "restore";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_get_reports", {
        p_status: statusFilter || null,
        p_category: categoryFilter || null,
        p_location: locationFilter || null,
        p_search: search.trim() || null,
        p_moderation: moderationFilter || null,
        p_page: page,
        p_limit: 15,
      });

      if (rpcErr) {
        console.error("admin_get_reports error:", rpcErr);
        setError(`Failed to load reports: ${rpcErr.message}`);
      } else if (data && Array.isArray(data)) {
        setReports(data as LostItem[]);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error("Fetch reports exception:", err);
      setError(err instanceof Error ? err.message : "Error fetching reports.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, locationFilter, search, moderationFilter, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExecuteModeration = async (reason: string) => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_moderate_item", {
        p_item_id: actionTarget.item.id,
        p_action: actionTarget.action,
        p_reason: reason || null,
      });

      if (rpcErr) {
        console.error("admin_moderate_item error:", rpcErr);
        setActionError(`Failed to moderate item: ${rpcErr.message}`);
      } else {
        setActionTarget(null);
        setSelectedReport(null);
        await fetchReports();
      }
    } catch (err) {
      console.error("Moderation exception:", err);
      setActionError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8E6E1] pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
              Report Moderation &amp; Management
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Review lost and found post submissions, inspect details, and flag or remove inappropriate posts.
            </p>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchReports} />}
        {actionError && <ErrorState title="Moderation Error" message={actionError} />}

        {/* Filter Controls */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <input
                type="text"
                placeholder="Search title, category..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3 py-2 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Lifecycle Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3 py-2 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
                <option value="claimed">Claimed</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3 py-2 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
              >
                <option value="">All Categories</option>
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3 py-2 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
              >
                <option value="">All Locations</option>
                {CAMPUS_LOCATIONS.filter((l) => l !== "All Locations").map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Moderation Status Filter */}
            <div>
              <select
                value={moderationFilter}
                onChange={(e) => {
                  setModerationFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3 py-2 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none font-semibold text-[#7A1F2B]"
              >
                <option value="">All Moderation States</option>
                <option value="active">Active Posts</option>
                <option value="flagged">Flagged Posts</option>
                <option value="removed">Removed Posts</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports Grid / Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 w-full rounded-2xl border border-[#E8E6E1] bg-white animate-shimmer" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports match your filters"
            description="Try adjusting your status, category, location, or moderation filter options."
          />
        ) : (
          <div className="space-y-3">
            {reports.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedReport(item)}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-2xs transition hover:border-[#7A1F2B]/40 hover:shadow-2xs cursor-pointer gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#E8E6E1] bg-[#FAFAF8]">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#6B6B67] text-[10px]">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-[#171717] truncate group-hover:text-[#7A1F2B]">
                        {item.title}
                      </h3>
                      <StatusBadge status={item.status} type="item" />
                      <StatusBadge
                        status={item.moderation_status || "active"}
                        type="moderation"
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#6B6B67] truncate">
                      {item.category} • {item.campus_location}
                    </p>
                    <p className="text-[10px] text-[#6B6B67] mt-0.5">
                      Reported: {new Date(item.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="text-xs font-semibold text-[#7A1F2B] group-hover:underline">
                    Inspect &amp; Moderate →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-[#E8E6E1] pt-4">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#FAFAF8] disabled:opacity-50"
          >
            ← Previous Page
          </button>
          <span className="text-xs font-semibold text-[#6B6B67]">
            Page {page}
          </span>
          <button
            disabled={reports.length < 15 || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#FAFAF8] disabled:opacity-50"
          >
            Next Page →
          </button>
        </div>

        {/* Report Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-md space-y-4 animate-dropdown">
              <div className="flex items-start justify-between border-b border-[#E8E6E1] pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <StatusBadge status={selectedReport.status} type="item" />
                    <StatusBadge status={selectedReport.moderation_status || "active"} type="moderation" />
                  </div>
                  <h3 className="text-lg font-extrabold text-[#171717]">
                    {selectedReport.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="rounded-lg p-1 text-[#6B6B67] hover:bg-[#FAFAF8] hover:text-[#171717]"
                >
                  ✕
                </button>
              </div>

              {selectedReport.image_url && (
                <div className="relative h-64 w-full overflow-hidden rounded-xl border border-[#E8E6E1] bg-[#FAFAF8]">
                  <Image
                    src={selectedReport.image_url}
                    alt={selectedReport.title}
                    fill
                    className="object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-[#6B6B67] block">Category:</span>
                  <span className="text-[#171717]">{selectedReport.category}</span>
                </div>
                <div>
                  <span className="font-bold text-[#6B6B67] block">Campus Location:</span>
                  <span className="text-[#171717]">{selectedReport.campus_location}</span>
                </div>
                <div>
                  <span className="font-bold text-[#6B6B67] block">Reporter User ID:</span>
                  <span className="text-[#171717] font-mono text-[11px] truncate block">{selectedReport.user_id}</span>
                </div>
                <div>
                  <span className="font-bold text-[#6B6B67] block">Report Date:</span>
                  <span className="text-[#171717]">
                    {new Date(selectedReport.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-[#6B6B67] text-xs block mb-1">Description:</span>
                <p className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 text-xs text-[#171717] leading-relaxed">
                  {selectedReport.description || "No description provided."}
                </p>
              </div>

              {selectedReport.moderation_reason && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-[#B88A3B]">
                  <span className="font-bold block">Previous Moderation Reason:</span>
                  {selectedReport.moderation_reason}
                </div>
              )}

              {/* Moderation Controls */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-[#E8E6E1]">
                {selectedReport.moderation_status !== "flagged" && (
                  <button
                    onClick={() => setActionTarget({ item: selectedReport, action: "flag" })}
                    className="rounded-xl bg-amber-100 border border-amber-300 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-200"
                  >
                    Flag Post
                  </button>
                )}

                {selectedReport.moderation_status !== "removed" && (
                  <button
                    onClick={() => setActionTarget({ item: selectedReport, action: "remove" })}
                    className="rounded-xl bg-red-100 border border-red-300 px-3.5 py-2 text-xs font-bold text-red-800 hover:bg-red-200"
                  >
                    Remove Post
                  </button>
                )}

                {selectedReport.moderation_status && selectedReport.moderation_status !== "active" && (
                  <button
                    onClick={() => setActionTarget({ item: selectedReport, action: "restore" })}
                    className="rounded-xl bg-emerald-100 border border-emerald-300 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                  >
                    Restore Post
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {actionTarget && (
          <ConfirmDialog
            isOpen={true}
            title={`Confirm Moderation Action: ${actionTarget.action.toUpperCase()}`}
            description={`Are you sure you want to ${actionTarget.action} the report "${actionTarget.item.title}"? This will modify post visibility for students without altering the item lifecycle status.`}
            warningText={
              actionTarget.action === "remove"
                ? "Removing a post hides it from student feeds. It can be restored later by an admin."
                : undefined
            }
            requireReason={actionTarget.action === "remove" || actionTarget.action === "flag"}
            reasonPlaceholder="State the moderation reason for student post management audit..."
            confirmText={`Execute ${actionTarget.action.toUpperCase()}`}
            confirmButtonVariant={actionTarget.action === "remove" ? "danger" : "warning"}
            isLoading={actionLoading}
            onClose={() => setActionTarget(null)}
            onConfirm={handleExecuteModeration}
          />
        )}
      </div>
    </AdminLayout>
  );
}
