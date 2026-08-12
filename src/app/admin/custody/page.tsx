"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { LostItem, ItemCustody } from "@/types/database";
import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

interface CustodyItemJoined {
  custody: ItemCustody;
  item: LostItem;
}

export default function AdminCustodyPage() {
  const [custodyItems, setCustodyItems] = useState<CustodyItemJoined[]>([]);
  const [allReports, setAllReports] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state for Receive Item
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [actionTarget, setActionTarget] = useState<{
    itemId: string;
    itemTitle: string;
    action: "receive" | "release";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCustodyData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch active custody records
      const { data: custodyData, error: custodyErr } = await (
        supabase.from("item_custody") as any
      )
        .select("*")
        .order("created_at", { ascending: false });

      if (custodyErr) {
        console.error("item_custody select error:", custodyErr);
        setError(`Failed to load physical custody records: ${custodyErr.message}`);
      }

      // 2. Fetch all reports to join items
      const { data: itemsData, error: itemsErr } = await (
        supabase.from("lost_items") as any
      )
        .select("*")
        .order("created_at", { ascending: false });

      if (itemsErr) {
        console.error("lost_items select error:", itemsErr);
        setError(`Failed to load lost items list: ${itemsErr.message}`);
      } else if (itemsData) {
        setAllReports(itemsData as LostItem[]);
      }

      if (custodyData && itemsData) {
        const itemMap = new Map<string, LostItem>(
          (itemsData as LostItem[]).map((i) => [i.id, i])
        );

        const joined: CustodyItemJoined[] = (custodyData as ItemCustody[])
          .map((c) => {
            const item = itemMap.get(c.lost_item_id);
            if (!item) return null;
            return { custody: c, item };
          })
          .filter(Boolean) as CustodyItemJoined[];

        setCustodyItems(joined);
      }
    } catch (err) {
      console.error("Custody fetch exception:", err);
      setError(err instanceof Error ? err.message : "Error loading custody records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustodyData();
  }, [fetchCustodyData]);

  const handleExecuteCustody = async (notes: string) => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_manage_custody", {
        p_item_id: actionTarget.itemId,
        p_action: actionTarget.action,
        p_notes: notes || null,
      });

      if (rpcErr) {
        console.error("admin_manage_custody error:", rpcErr);
        setActionError(`Failed to update custody: ${rpcErr.message}`);
      } else {
        setActionTarget(null);
        setSelectedItemId("");
        await fetchCustodyData();
      }
    } catch (err) {
      console.error("Custody RPC exception:", err);
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
              College Security Vault &amp; Physical Custody
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Log physical receipt of items placed in administrative custody or release them to verified owners.
            </p>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchCustodyData} />}
        {actionError && <ErrorState title="Custody RPC Error" message={actionError} />}

        {/* Action Form Bar: Place New Item in Custody */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
            + Place Item in Security Vault Custody
          </h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="flex-1 rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
            >
              <option value="">Select an Item to Place in Custody...</option>
              {allReports.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.status.toUpperCase()}] {item.title} — {item.campus_location} ({item.category})
                </option>
              ))}
            </select>

            <button
              disabled={!selectedItemId}
              onClick={() => {
                const targetItem = allReports.find((i) => i.id === selectedItemId);
                if (targetItem) {
                  setActionTarget({
                    itemId: targetItem.id,
                    itemTitle: targetItem.title,
                    action: "receive",
                  });
                }
              }}
              className="rounded-xl bg-[#7A1F2B] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#631822] disabled:opacity-50 shrink-0"
            >
              Receive into Vault
            </button>
          </div>
        </div>

        {/* Custody Items List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 w-full rounded-2xl border border-[#E8E6E1] bg-white animate-shimmer" />
            ))}
          </div>
        ) : custodyItems.length === 0 ? (
          <EmptyState
            title="No items currently in physical custody"
            description="Use the selector above to log physical receipt of items delivered to the college security desk."
          />
        ) : (
          <div className="space-y-4">
            {custodyItems.map(({ custody, item }) => (
              <div
                key={custody.id}
                className="rounded-2xl border border-[#E8E6E1] bg-white p-5 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E8E6E1] pb-3 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E8E6E1] bg-[#FAFAF8]">
                      {item.image_url ? (
                        <Image src={item.image_url} alt={item.title} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-[#6B6B67]">
                          No image
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-extrabold text-[#171717]">{item.title}</h3>
                        <StatusBadge status={custody.status} type="custody" />
                      </div>
                      <p className="text-xs text-[#6B6B67] mt-0.5">
                        Category: {item.category} • Found/Reported Location: {item.campus_location}
                      </p>
                    </div>
                  </div>

                  {custody.status === "received" && (
                    <button
                      onClick={() =>
                        setActionTarget({
                          itemId: item.id,
                          itemTitle: item.title,
                          action: "release",
                        })
                      }
                      className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-bold text-[#4F7C68] hover:bg-emerald-100 shrink-0 self-end sm:self-center"
                    >
                      Release from Vault
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 space-y-0.5">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      Custody Status
                    </span>
                    <p className="font-bold text-[#7A1F2B] uppercase">{custody.status}</p>
                    <p className="text-[10px] text-[#6B6B67]">
                      Received: {new Date(custody.received_at).toLocaleString("en-IN")}
                    </p>
                    {custody.released_at && (
                      <p className="text-[10px] text-[#4F7C68] font-semibold">
                        Released: {new Date(custody.released_at).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2 rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 space-y-0.5">
                    <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block">
                      Admin Notes &amp; Vault Desk Log
                    </span>
                    <p className="text-[#171717] leading-relaxed">
                      {custody.notes || "No notes logged for this custody record."}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmation Dialog */}
        {actionTarget && (
          <ConfirmDialog
            isOpen={true}
            title={
              actionTarget.action === "receive"
                ? "Confirm Receipt into Security Vault"
                : "Confirm Item Release from Vault"
            }
            description={
              actionTarget.action === "receive"
                ? "Confirm that this physical item has been received by the college and placed in custody."
                : "Confirm that this physical item is being released to the verified recipient."
            }
            requireReason={false}
            reasonPlaceholder="Log notes (e.g. Received at Block A desk by Officer...)"
            confirmText={actionTarget.action === "receive" ? "Place in Vault" : "Confirm Release"}
            confirmButtonVariant={actionTarget.action === "receive" ? "primary" : "success"}
            isLoading={actionLoading}
            onClose={() => setActionTarget(null)}
            onConfirm={handleExecuteCustody}
          />
        )}
      </div>
    </AdminLayout>
  );
}
