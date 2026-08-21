"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

interface CandidateMatch {
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

interface ClaimModalProps {
  itemId: string;
  claimantItemId?: string | null;
  isAiInitiated?: boolean;
  itemTitle: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function ClaimModal({
  itemId,
  claimantItemId,
  itemTitle,
  onClose,
  onSuccess,
}: ClaimModalProps) {
  const [step, setStep] = useState<"form" | "link_optional">("form");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional post-submission linking state
  const [createdClaimId, setCreatedClaimId] = useState<string | null>(null);
  const [candidateReports, setCandidateReports] = useState<CandidateMatch[]>([]);
  const [linkingLoading, setLinkingLoading] = useState(false);

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

      // Check if claimant_item_id was pre-supplied via URL query or prop (e.g. AI match flow)
      const urlClaimantItemId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("claimant_item_id")
          : null;
      const effectiveClaimantItemId = claimantItemId || urlClaimantItemId || null;

      const claimInsert: Database["public"]["Tables"]["claims"]["Insert"] = {
        lost_item_id: itemId,
        claimant_item_id: effectiveClaimantItemId,
        claimant_id: user.id,
        message: trimmedMsg,
        proof_image_url: proofUrl,
        status: "pending",
      };

      const { data: insertedData, error: insertError } = await (supabase.from("claims") as any)
        .insert(claimInsert)
        .select("id")
        .single();

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
        setSubmitting(false);
        return;
      }

      const claimId = insertedData?.id;

      // Clean up local form state
      setMessage("");
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setError(null);

      // If claim was ALREADY linked (e.g. via AI match flow), finish immediately
      if (effectiveClaimantItemId) {
        await onSuccess();
        onClose();
        return;
      }

      // Query active opposite-type report IDs belonging to claimant
      const { data: targetItemData } = await (supabase.from("lost_items") as any)
        .select("id, item_type")
        .eq("id", itemId)
        .maybeSingle();

      const targetType = targetItemData?.item_type || "found";
      const oppositeType = targetType === "found" ? "lost" : "found";

      const { data: userReportsData } = await (supabase.from("lost_items") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("item_type", oppositeType)
        .in("status", ["lost", "found"])
        .neq("id", itemId);

      if (userReportsData && Array.isArray(userReportsData) && userReportsData.length > 0 && claimId) {
        const userReportIds = new Set(userReportsData.map((r: any) => r.id));

        // Evaluate candidate matches using existing /api/match hybrid engine
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const matchRes = await fetch(`/api/match?itemId=${encodeURIComponent(itemId)}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (matchRes.ok) {
          const matchData = await matchRes.json();
          if (matchData.success && Array.isArray(matchData.matches)) {
            // Filter matches: candidate must belong to the authenticated claimant and pass match threshold (>=55%)
            const strongCandidates: CandidateMatch[] = matchData.matches.filter(
              (m: CandidateMatch) => userReportIds.has(m.id) && m.match_score >= 55
            );

            if (strongCandidates.length > 0) {
              setCreatedClaimId(claimId);
              setCandidateReports(strongCandidates);
              setStep("link_optional");
              return;
            }
          }
        }
      }

      // If no strong candidates exist or matching yields no strong overlap, finish cleanly
      await onSuccess();
      onClose();
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

  const handleLinkReport = async (reportId: string) => {
    if (!createdClaimId) {
      await onSuccess();
      onClose();
      return;
    }

    setLinkingLoading(true);
    setError(null);

    try {
      // Call secure SECURITY DEFINER RPC to persist claimant_item_id
      const { error: rpcErr } = await (supabase as any).rpc("link_claimant_report", {
        p_claim_id: createdClaimId,
        p_claimant_item_id: reportId,
      });

      if (rpcErr) {
        console.warn("Failed to link report via RPC:", rpcErr);
        setError(`Report linking failed: ${rpcErr.message}. Claim has been submitted.`);
        setLinkingLoading(false);
        return;
      }

      setLinkingLoading(false);
      await onSuccess();
      onClose();
    } catch (err) {
      console.warn("Error linking report:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to link report to your claim."
      );
      setLinkingLoading(false);
    }
  };

  const handleSkipLinking = async () => {
    await onSuccess();
    onClose();
  };

  const handleCloseModal = async () => {
    if (step === "link_optional") {
      // Claim was already created successfully with claimant_item_id = null.
      // Call onSuccess() so the page updates cleanly, then close.
      await onSuccess();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-md animate-dropdown">
        {step === "form" ? (
          <>
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
                onClick={handleCloseModal}
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
                  onClick={handleCloseModal}
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
          </>
        ) : (
          <>
            {/* Step 2: Optional Post-Submission Plausible AI Report Linking */}
            <div className="flex items-start justify-between border-b border-[#E8E6E1] pb-3 mb-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-1">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Claim Submitted Successfully
                </div>
                <h2 className="text-base font-bold text-[#171717]">
                  Do you also have a report for this item?
                </h2>
                <p className="mt-0.5 text-xs text-[#6B6B67] leading-relaxed">
                  Linking your matching report keeps both reports synchronized when approved or returned.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
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

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {candidateReports.map((report) => {
                const reportDate = report.incident_at;
                const formattedDate = reportDate
                  ? new Date(reportDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "";

                return (
                  <div
                    key={report.id}
                    onClick={() => handleLinkReport(report.id)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 transition hover:border-[#7A1F2B]/40 hover:bg-white cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {report.image_url ? (
                        <img
                          src={report.image_url}
                          alt={report.title}
                          className="h-12 w-12 rounded-lg object-cover border border-[#E8E6E1] shrink-0"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 border border-[#E8E6E1]">
                          <svg className="h-6 w-6 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="rounded border bg-[#7A1F2B]/10 border-[#7A1F2B]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#7A1F2B] uppercase">
                            {(report.item_type || "report").toUpperCase()}
                          </span>
                          <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold">
                            {report.match_score}% AI Match
                          </span>
                          <span className="text-[10px] text-[#6B6B67] truncate">{report.category}</span>
                        </div>
                        <h4 className="text-xs font-bold text-[#171717] truncate group-hover:text-[#7A1F2B]">
                          {report.title}
                        </h4>
                        <p className="text-[10px] text-[#6B6B67] truncate">
                          {report.campus_location} {formattedDate ? `• ${formattedDate}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={linkingLoading}
                      className="shrink-0 rounded-lg border border-[#7A1F2B] bg-white px-3 py-1 text-xs font-bold text-[#7A1F2B] shadow-2xs transition hover:bg-[#7A1F2B] hover:text-white disabled:opacity-50"
                    >
                      {linkingLoading ? "Linking..." : "Link Report"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E8E6E1] mt-4">
              <p className="text-[10px] text-[#6B6B67]">
                You can skip if this claim does not relate to your reports.
              </p>
              <button
                type="button"
                onClick={handleSkipLinking}
                disabled={linkingLoading}
                className="rounded-lg border border-[#E8E6E1] bg-white px-4 py-2 text-xs font-semibold text-[#171717] transition hover:bg-[#FAFAF8] disabled:opacity-50"
              >
                Skip &amp; Finish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
