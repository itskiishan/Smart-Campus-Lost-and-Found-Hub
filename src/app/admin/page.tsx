"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { AdminDashboardStats, AdminAuditLog } from "@/types/database";
import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/admin/StatCard";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Stats via admin_get_dashboard_stats RPC
      const { data: statsData, error: statsErr } = await (supabase as any).rpc(
        "admin_get_dashboard_stats"
      );

      if (statsErr) {
        console.error("RPC admin_get_dashboard_stats error:", statsErr);
        setError(`Failed to load admin statistics: ${statsErr.message}`);
      } else if (statsData && statsData.length > 0) {
        setStats(statsData[0] as AdminDashboardStats);
      }

      // 2. Fetch Audit Logs via admin_get_audit_logs RPC
      const { data: logsData } = await (supabase as any).rpc(
        "admin_get_audit_logs",
        { p_limit: 8 }
      );

      if (logsData && Array.isArray(logsData)) {
        setAuditLogs(logsData as AdminAuditLog[]);
      }
    } catch (err) {
      console.error("Dashboard load exception:", err);
      setError(
        err instanceof Error ? err.message : "Error loading admin dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between border-b border-[#E8E6E1] pb-3">
          <div>
            <h2 className="text-base font-extrabold text-[#171717]">
              System Status &amp; Operational Metrics
            </h2>
            <p className="text-xs text-[#6B6B67]">
              Real-time oversight of reports, verification claims, physical handovers, and security vault custody.
            </p>
          </div>

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] shadow-2xs hover:bg-[#FAFAF8] disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 text-[#6B6B67] ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>

        {error && <ErrorState message={error} onRetry={fetchAdminData} />}

        {/* Primary Statistics Hierarchy */}
        <div>
          <h3 className="text-xs font-bold text-[#6B6B67] uppercase tracking-wider mb-2.5">
            Primary Lifecycle Statistics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard
              label="Total Reports"
              value={loading ? "..." : stats?.total_reports ?? 0}
              subtext="All time campus reports"
              href="/admin/reports"
            />
            <StatCard
              label="Lost"
              value={loading ? "..." : stats?.lost_count ?? 0}
              subtext="Missing items"
              valueColor="text-[#C94A4A]"
              href="/admin/reports?status=lost"
            />
            <StatCard
              label="Found"
              value={loading ? "..." : stats?.found_count ?? 0}
              subtext="Recovered on campus"
              valueColor="text-[#4F7C68]"
              href="/admin/reports?status=found"
            />
            <StatCard
              label="Claimed"
              value={loading ? "..." : stats?.claimed_count ?? 0}
              subtext="Accepted claims"
              valueColor="text-[#B88A3B]"
              href="/admin/reports?status=claimed"
            />
            <StatCard
              label="Returned"
              value={loading ? "..." : stats?.returned_count ?? 0}
              subtext="In-person handed over"
              valueColor="text-[#4F7C68]"
              href="/admin/reports?status=returned"
            />
          </div>
        </div>

        {/* Operational Statistics Hierarchy */}
        <div>
          <h3 className="text-xs font-bold text-[#6B6B67] uppercase tracking-wider mb-2.5">
            Operational Metrics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard
              label="Pending Claims"
              value={loading ? "..." : stats?.pending_claims_count ?? 0}
              subtext="Needs owner review"
              valueColor="text-[#B88A3B]"
              href="/admin/claims"
            />
            <StatCard
              label="Active Handovers"
              value={loading ? "..." : stats?.active_handovers_count ?? 0}
              subtext="OTP phase"
              valueColor="text-blue-700"
              href="/admin/handovers"
            />
            <StatCard
              label="Flagged Reports"
              value={loading ? "..." : stats?.flagged_items_count ?? 0}
              subtext="Under moderation review"
              valueColor="text-amber-800"
              href="/admin/reports?moderation=flagged"
            />
            <StatCard
              label="Items in Vault Custody"
              value={loading ? "..." : stats?.custody_items_count ?? 0}
              subtext="In security possession"
              valueColor="text-[#7A1F2B]"
              href="/admin/custody"
            />
            <StatCard
              label="Total Registered Users"
              value={loading ? "..." : stats?.total_users_count ?? 0}
              subtext="Registered campus accounts"
              href="/admin/users"
            />
          </div>
        </div>

        {/* Needs Attention Alert Section */}
        <div>
          <h3 className="text-xs font-bold text-[#6B6B67] uppercase tracking-wider mb-2.5">
            Needs Attention
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/admin/claims?status=pending"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-2xs transition hover:bg-amber-100/60"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717]">Pending Claims</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-[#B88A3B] border border-amber-200">
                  {loading ? "..." : stats?.pending_claims_count ?? 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B67]">
                Review student claim messages and verification details.
              </p>
            </Link>

            <Link
              href="/admin/reports?moderation=flagged"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-2xs transition hover:bg-red-100/60"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717]">Flagged Reports</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-[#C94A4A] border border-red-200">
                  {loading ? "..." : stats?.flagged_items_count ?? 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B67]">
                Inspect flagged posts for moderation or removal.
              </p>
            </Link>

            <Link
              href="/admin/handovers?status=active"
              className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-2xs transition hover:bg-blue-100/60"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717]">Active Handovers</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-blue-700 border border-blue-200">
                  {loading ? "..." : stats?.active_handovers_count ?? 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B67]">
                Track items currently undergoing OTP verification.
              </p>
            </Link>

            <Link
              href="/admin/custody"
              className="rounded-2xl border border-[#7A1F2B]/20 bg-[#F6EDEF] p-4 shadow-2xs transition hover:bg-[#F6EDEF]/80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#171717]">Vault Custody Items</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-[#7A1F2B] border border-[#7A1F2B]/20">
                  {loading ? "..." : stats?.custody_items_count ?? 0}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B67]">
                Items stored physically at college security desks.
              </p>
            </Link>
          </div>
        </div>

        {/* Audit Stream Feed */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8E6E1] pb-2.5">
            <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
              Recent Administrative Audit Stream
            </h3>
            <Link href="/admin/audit-logs" className="text-xs font-semibold text-[#7A1F2B] hover:underline">
              View All Logs →
            </Link>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-[#6B6B67] py-4 text-center">
              No administrative events recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5 divide-y divide-[#E8E6E1]">
              {auditLogs.map((log) => (
                <div key={log.id} className="pt-2.5 first:pt-0 text-xs flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#7A1F2B]">{log.action}</span>
                      <span className="text-[10px] text-[#6B6B67]">• {log.entity_type}</span>
                    </div>
                    <p className="text-[#171717] mt-0.5">
                      Admin: <span className="font-semibold">{log.admin_full_name || "Admin"}</span>
                    </p>
                    {log.reason && (
                      <p className="text-[11px] text-[#6B6B67] italic mt-0.5">
                        Reason: &quot;{log.reason}&quot;
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#6B6B67] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
