"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdminAuditLog } from "@/types/database";
import AdminLayout from "@/components/AdminLayout";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_get_audit_logs", {
        p_limit: 100,
      });

      if (rpcErr) {
        console.error("admin_get_audit_logs error:", rpcErr);
        setError(`Failed to load audit logs: ${rpcErr.message}`);
      } else if (data && Array.isArray(data)) {
        setLogs(data as AdminAuditLog[]);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Fetch audit logs exception:", err);
      setError(err instanceof Error ? err.message : "Error loading audit logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8E6E1] pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
              Administrative Audit Logs
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Read-only system audit stream recording all administrative moderation, dispute resolution, custody, location, and role events.
            </p>
          </div>

          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E6E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#171717] shadow-2xs hover:bg-[#FAFAF8] disabled:opacity-50"
          >
            Refresh Stream
          </button>
        </div>

        {error && <ErrorState message={error} onRetry={fetchAuditLogs} />}

        {/* Audit Logs Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-full rounded-2xl border border-[#E8E6E1] bg-white animate-shimmer" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit logs recorded"
            description="Administrative actions (moderation, claims, custody, role assignments) will automatically generate audit logs here."
          />
        ) : (
          <div className="rounded-2xl border border-[#E8E6E1] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAFAF8] text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider">
                    <th className="p-3.5 pl-4">Timestamp</th>
                    <th className="p-3.5">Administrator</th>
                    <th className="p-3.5">Action Executed</th>
                    <th className="p-3.5">Entity Type</th>
                    <th className="p-3.5">Target Entity ID</th>
                    <th className="p-3.5 pr-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E6E1]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAFAF8]/80 transition">
                      <td className="p-3.5 pl-4 whitespace-nowrap text-[#6B6B67]">
                        {new Date(log.created_at).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3.5 font-bold text-[#171717]">
                        {log.admin_full_name || "Admin"}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center rounded bg-[#F6EDEF] px-2 py-0.5 text-[10px] font-bold text-[#7A1F2B] font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#6B6B67] uppercase font-semibold text-[10px]">
                        {log.entity_type}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-[#6B6B67]">
                        {log.entity_id ? log.entity_id.slice(0, 18) + "..." : "N/A"}
                      </td>
                      <td className="p-3.5 pr-4 text-[#171717] italic">
                        {log.reason ? `"${log.reason}"` : "No reason logged."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
