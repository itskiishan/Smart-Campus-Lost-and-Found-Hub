"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LostItem } from "@/types/database";

interface DeleteConfirmModalProps {
  item: LostItem;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function DeleteConfirmModal({
  item,
  onClose,
  onSuccess,
}: DeleteConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== item.user_id) {
        setError("Unauthorized: Only the report owner can delete this report.");
        setSubmitting(false);
        return;
      }

      if (item.status === "claimed" || item.status === "returned") {
        setError("This report cannot be deleted because a claim or handover is in progress/completed.");
        setSubmitting(false);
        return;
      }

      // Delete any pending claims associated with this item to prevent FK dependency errors
      await (supabase.from("claims") as any)
        .delete()
        .eq("lost_item_id", item.id)
        .eq("status", "pending");

      // Delete item record from lost_items
      const { error: deleteErr } = await (supabase
        .from("lost_items") as any)
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (deleteErr) {
        setError(`Failed to delete report: ${deleteErr.message}`);
      } else {
        await onSuccess();
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred while deleting the report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-md animate-dropdown">
        <div className="flex items-center gap-3 text-[#C94A4A] mb-3">
          <div className="rounded-full bg-red-100 p-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#171717]">
              Delete Report?
            </h2>
            <p className="text-xs text-[#6B6B67]">
              Permanent action warning.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-[#C94A4A]">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs text-[#6B6B67]">
          <p>
            Are you sure you want to delete <strong className="text-[#171717]">"{item.title}"</strong>?
          </p>
          <p className="rounded-xl bg-red-50 p-3 text-[11px] font-semibold text-[#C94A4A]">
            ⚠️ Warning: This will permanently remove the report listing from the campus portal. This action cannot be undone.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#E8E6E1] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E8E6E1] bg-white px-4 py-2 text-xs font-semibold text-[#6B6B67] hover:bg-[#FAFAF8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="rounded-xl bg-[#C94A4A] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B33B3B] disabled:opacity-50"
          >
            {submitting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
