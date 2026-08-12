"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { AdminClaimDetail } from "@/types/database";
import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<AdminClaimDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("pending");

  // Selected Action Target
  const [resolveTarget, setResolveTarget] = useState<{
    claim: AdminClaimDetail;
    action: "approve" | "reject";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_get_claims", {
        p_status: statusFilter || null,
      });

      if (rpcErr) {
        console.error("admin_get_claims error:", rpcErr);
        setError(`Failed to load claims: ${rpcErr.message}`);
      } else if (data && Array.isArray(data)) {
        setClaims(data as AdminClaimDetail[]);
      } else {
        setClaims([]);
      }
    } catch (err) {
      console.error("Fetch claims exception:", err);
      setError(err instanceof Error ? err.message : "Error loading claims.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleResolveClaim = async (reason: string) => {
    if (!resolveTarget) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_resolve_claim", {
        p_claim_id: resolveTarget.claim.id,
        p_action: resolveTarget.action,
        p_reason: reason || null,
      });

      if (rpcErr) {
        console.error("admin_resolve_claim error:", rpcErr);
        setActionError(`Failed to resolve claim: ${rpcErr.message}`);
      } else {
        setResolveTarget(null);
        await fetchClaims();
      }
    } catch (err) {
      console.error("Resolve claim exception:", err);
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
              Claims Oversight &amp; Dispute Resolution
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Review verification messages, student admission numbers, and claim proof images submitted by claimants.
            </p>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchClaims} />}
        {actionError && <ErrorState title="Resolution Error" message={actionError} />}

        {/* Filter Bar */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            {["pending", "approved", "rejected", ""].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-[#7A1F2B] text-white shadow-2xs"
                    : "bg-[#FAFAF8] text-[#6B6B67] hover:bg-[#E8E6E1] hover:text-[#171717]"
                }`}
              >
                {st === "" ? "All Claims" : st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Claims List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 w-full rounded-2xl border border-[#E8E6E1] bg-white animate-shimmer" />
            ))}
          </div>
        ) : claims.length === 0 ? (
          <EmptyState
            title={`No ${statusFilter ? statusFilter : ""} claims found`}
            description="There are currently no verification claims matching this filter status."
          />
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E6E1] pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#6B6B67]">Item:</span>
                      <h3 className="text-sm font-extrabold text-[#171717]">
                        {claim.item_title || "Lost Item"}
                      </h3>
                      <StatusBadge status={claim.status} type="claim" />
                    </div>
                    <p className="text-[11px] text-[#6B6B67] mt-0.5">
                      Submitted: {new Date(claim.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="text-xs sm:text-right">
                    <p className="text-[#171717]">
                      Reporter: <span className="font-semibold">{claim.reporter_name || "Owner"}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Claimant Profile Info */}
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3.5 space-y-1">
                    <span className="text-[10px] font-bold text-[#7A1F2B] uppercase tracking-wider block">
                      Claimant Information
                    </span>
                    <p className="font-extrabold text-[#171717]">{claim.claimant_name || "Student"}</p>
                    <p className="text-[#6B6B67]">
                      Admission No: <span className="font-mono font-semibold text-[#171717]">{claim.claimant_admission_number || "N/A"}</span>
                    </p>
                  </div>

                  {/* Verification Message */}
                  <div className="sm:col-span-2 rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3.5 space-y-1">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      Verification Message
                    </span>
                    <p className="text-[#171717] leading-relaxed italic">
                      &quot;{claim.message}&quot;
                    </p>
                  </div>
                </div>

                {/* Proof Image if present */}
                {claim.proof_image_url && (
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 space-y-1">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      Attached Proof of Ownership Image
                    </span>
                    <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-[#E8E6E1]">
                      <Image
                        src={claim.proof_image_url}
                        alt="Proof of ownership"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Admin Actions for Pending Claims */}
                {claim.status === "pending" && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6E1]">
                    <button
                      onClick={() => setResolveTarget({ claim, action: "reject" })}
                      className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-xs font-bold text-[#C94A4A] hover:bg-red-100"
                    >
                      Reject Claim
                    </button>
                    <button
                      onClick={() => setResolveTarget({ claim, action: "approve" })}
                      className="rounded-xl bg-[#7A1F2B] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#631822]"
                    >
                      Approve Claim
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Confirmation Dialog */}
        {resolveTarget && (
          <ConfirmDialog
            isOpen={true}
            title={resolveTarget.action === "approve" ? "Approve Claim Override" : "Reject Claim"}
            description={
              resolveTarget.action === "approve"
                ? `Are you sure you want to approve ${resolveTarget.claim.claimant_name}'s claim for "${resolveTarget.claim.item_title}"?`
                : `Reject this claim?`
            }
            warningText={
              resolveTarget.action === "approve"
                ? "Approving this claim will mark the item as CLAIMED and reject other pending claims for the same item."
                : undefined
            }
            requireReason={false}
            reasonPlaceholder="State the administrative reason for this dispute resolution..."
            confirmText={resolveTarget.action === "approve" ? "Confirm Claim Approval" : "Confirm Rejection"}
            confirmButtonVariant={resolveTarget.action === "approve" ? "primary" : "danger"}
            isLoading={actionLoading}
            onClose={() => setResolveTarget(null)}
            onConfirm={handleResolveClaim}
          />
        )}
      </div>
    </AdminLayout>
  );
}
