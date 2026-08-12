"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

interface ClaimModalProps {
  itemId: string;
  itemTitle: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function ClaimModal({
  itemId,
  itemTitle,
  onClose,
  onSuccess,
}: ClaimModalProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Unsupported image type. Please select a JPEG, PNG, or WEBP image.");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Proof image is too large. Maximum allowed size is 5MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setError("Ownership verification message is required.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to submit a claim.");
        setSubmitting(false);
        return;
      }

      let proofUrl: string | null = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop() || "jpg";
        const sanitizedFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `${user.id}/claims/${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("item-photos")
          .upload(filePath, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) {
          console.warn("Proof photo upload warning:", uploadError);
          setError(`Proof image upload failed: ${uploadError.message}. Please try again.`);
          setSubmitting(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("item-photos")
          .getPublicUrl(filePath);

        proofUrl = publicUrlData?.publicUrl || null;
      }

      const claimInsert: Database["public"]["Tables"]["claims"]["Insert"] = {
        lost_item_id: itemId,
        claimant_id: user.id,
        message: trimmedMsg,
        proof_image_url: proofUrl,
        status: "pending",
      };

      const { error: insertError } = await (supabase.from("claims") as any).insert(claimInsert);

      if (insertError) {
        const lowerMsg = insertError.message.toLowerCase();
        if (
          lowerMsg.includes("unique") ||
          lowerMsg.includes("already exists") ||
          lowerMsg.includes("claims_lost_item_id_claimant_id_key")
        ) {
          setError("You have already submitted a claim for this item.");
        } else {
          setError(`Failed to submit claim: ${insertError.message}`);
        }
      } else {
        setMessage("");
        setSelectedFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setError(null);
        await onSuccess();
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while submitting your claim."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-md animate-dropdown">
        <div className="flex items-start justify-between border-b border-[#E8E6E1] pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#171717]">
              Claim Ownership
            </h2>
            <p className="mt-0.5 text-xs text-[#6B6B67] leading-relaxed">
              Provide information that helps the reporter verify that this item belongs to you.
            </p>
            <p className="mt-1 text-[11px] font-semibold text-[#7A1F2B] truncate max-w-xs">
              Item: {itemTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1 text-[#6B6B67] hover:bg-[#FAFAF8] hover:text-[#171717]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-[#C94A4A]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="claimMessage" className="block text-xs font-semibold text-[#171717] mb-1">
              Describe details to verify ownership <span className="text-[#C94A4A]">*</span>
            </label>
            <textarea
              id="claimMessage"
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe unique marks, scratches, contents, serial numbers, stickers, or other details that help verify your ownership..."
              className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
            />
            <p className="mt-1 text-[10px] text-[#6B6B67]">
              This verification message will only be visible to the student who reported this item.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Proof Photo <span className="text-[10px] font-normal text-[#6B6B67] uppercase">(Optional)</span>
            </label>
            {previewUrl ? (
              <div className="relative aspect-[16/9] w-full max-w-xs overflow-hidden rounded-xl border border-[#E8E6E1] bg-[#FAFAF8]">
                <img src={previewUrl} alt="Proof preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute right-2 top-2 rounded-lg bg-[#C94A4A] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="proofPhotoInput"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#E8E6E1] bg-[#FAFAF8] py-3 text-xs font-medium text-[#6B6B67] transition hover:border-[#7A1F2B] hover:text-[#171717]"
                >
                  <svg className="h-4 w-4 text-[#7A1F2B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  </svg>
                  Attach photo proof (JPEG, PNG, WEBP &lt; 5MB)
                </label>
                <input
                  id="proofPhotoInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E6E1]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E8E6E1] bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition hover:bg-[#FAFAF8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#631822] disabled:opacity-50"
            >
              {submitting ? "Submitting Claim..." : "Submit Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
