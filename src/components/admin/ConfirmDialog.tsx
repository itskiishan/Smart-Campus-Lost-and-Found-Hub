"use client";

import { useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  warningText?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonVariant?: "danger" | "warning" | "success" | "primary";
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  warningText,
  requireReason = false,
  reasonPlaceholder = "Provide a reason for audit logging...",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonVariant = "primary",
  isLoading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      setError("A reason is required for this action.");
      return;
    }
    setError(null);
    onConfirm(reason.trim());
  };

  const getVariantStyles = () => {
    switch (confirmButtonVariant) {
      case "danger":
        return "bg-[#C94A4A] text-white hover:bg-red-700";
      case "warning":
        return "bg-[#B88A3B] text-white hover:bg-amber-700";
      case "success":
        return "bg-[#4F7C68] text-white hover:bg-emerald-800";
      default:
        return "bg-[#7A1F2B] text-white hover:bg-[#631822]";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-md animate-dropdown">
        <h3 className="text-base font-extrabold text-[#171717]">{title}</h3>
        <p className="mt-1 text-xs text-[#6B6B67] leading-relaxed">{description}</p>

        {warningText && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-[#B88A3B]">
            {warningText}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-[#C94A4A]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {(requireReason || reasonPlaceholder) && (
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Reason {requireReason ? <span className="text-[#C94A4A]">*</span> : <span className="text-[10px] text-[#6B6B67]">(Optional)</span>}
              </label>
              <textarea
                rows={3}
                required={requireReason}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={reasonPlaceholder}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6E1]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-[#E8E6E1] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#FAFAF8] disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`rounded-lg px-4 py-2 text-xs font-bold shadow-2xs transition disabled:opacity-50 ${getVariantStyles()}`}
            >
              {isLoading ? "Processing..." : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
