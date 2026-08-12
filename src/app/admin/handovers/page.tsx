"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdminHandoverDetail } from "@/types/database";
import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminHandoversPage() {
  const [handovers, setHandovers] = useState<AdminHandoverDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("active");

  const fetchHandovers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_get_handovers", {
        p_status: statusFilter || null,
      });

      if (rpcErr) {
        console.error("admin_get_handovers error:", rpcErr);
        setError(`Failed to load handovers: ${rpcErr.message}`);
      } else if (data && Array.isArray(data)) {
        setHandovers(data as AdminHandoverDetail[]);
      } else {
        setHandovers([]);
      }
    } catch (err) {
      console.error("Fetch handovers exception:", err);
      setError(err instanceof Error ? err.message : "Error loading handovers.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchHandovers();
  }, [fetchHandovers]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8E6E1] pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
              Physical Handover Oversight
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Monitor active in-person OTP exchange sessions between reporters and approved claimants.
            </p>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchHandovers} />}

        {/* Filter Bar */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            {["active", "completed", "expired", "cancelled", ""].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-[#7A1F2B] text-white shadow-2xs"
                    : "bg-[#FAFAF8] text-[#6B6B67] hover:bg-[#E8E6E1] hover:text-[#171717]"
                }`}
              >
                {st === "" ? "All Handovers" : st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Handover Cards */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 w-full rounded-2xl border border-[#E8E6E1] bg-white animate-shimmer" />
            ))}
          </div>
        ) : handovers.length === 0 ? (
          <EmptyState
            title={`No ${statusFilter ? statusFilter : ""} handovers found`}
            description="There are no active or historical handover sessions matching this status filter."
          />
        ) : (
          <div className="space-y-3">
            {handovers.map((h) => (
              <div
                key={h.id}
                className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E6E1] pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-[#171717]">
                        Item: {h.item_title || "Lost Item"}
                      </h3>
                      <StatusBadge status={h.status} type="handover" />
                    </div>
                    <p className="text-[11px] text-[#6B6B67] mt-0.5">
                      Handover Location: <span className="font-semibold text-[#171717]">{h.handover_location}</span>
                    </p>
                  </div>

                  <div className="text-xs sm:text-right">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      OTP Expiration
                    </span>
                    <span className="font-mono text-[#171717]">
                      {new Date(h.otp_expires_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Reporter Info */}
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 space-y-0.5">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      Item Reporter
                    </span>
                    <p className="font-bold text-[#171717]">{h.reporter_name || "Reporter"}</p>
                    <p className="text-[11px] text-[#6B6B67] font-mono">{h.reporter_id}</p>
                  </div>

                  {/* Claimant Info */}
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 space-y-0.5">
                    <span className="text-[10px] font-bold text-[#7A1F2B] uppercase tracking-wider block">
                      Verified Claimant
                    </span>
                    <p className="font-extrabold text-[#171717]">{h.claimant_name || "Claimant"}</p>
                    <p className="text-[#6B6B67]">
                      Admission No: <span className="font-mono font-semibold text-[#171717]">{h.claimant_admission_number || "N/A"}</span>
                    </p>
                  </div>

                  {/* Schedule & Timing */}
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 space-y-0.5">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      Schedule Details
                    </span>
                    <p className="text-[#171717]">
                      Time Window: <span className="font-semibold">{h.preferred_time || "Anytime campus hours"}</span>
                    </p>
                    <p className="text-[#6B6B67]">
                      Mode: <span className="font-semibold text-[#171717] uppercase">{h.handover_mode}</span>
                    </p>
                  </div>
                </div>

                {/* Security Note */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-[#4F7C68] flex items-center justify-between">
                  <span>
                    🔒 Plaintext OTP codes are hashed via SHA-256 and never stored or returned to administrators.
                  </span>
                  <span className="text-[10px] font-bold uppercase">SECURE HANDOVER</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
