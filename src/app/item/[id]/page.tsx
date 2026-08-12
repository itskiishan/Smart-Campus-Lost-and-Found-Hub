"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { LostItem, ClaimRow, ReporterClaimDetail, HandoverDetail } from "@/types/database";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import Header from "@/components/Header";
import ClaimModal from "@/components/ClaimModal";
import { AIMatchSuggestions } from "@/components/AIMatchSuggestions";
import type { User } from "@supabase/supabase-js";

const HANDOVER_SPOTS = [
  "College Security Desk - Main Gate",
  "College Admin Office Desk",
  "Campus Canteen - Ground Floor",
  "Ramanujan Block - Reception Desk",
  "Aryabhatta Block - Reception Desk",
  "Central Library Counter",
];

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "JUST NOW";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}M AGO`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}H AGO`;
  if (diffInSeconds < 172800) return "YESTERDAY";
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}D AGO`;

  return date
    .toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}

export default function ItemDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params?.id as string;

  const [item, setItem] = useState<LostItem | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Claimant state
  const [userClaim, setUserClaim] = useState<ClaimRow | null>(null);
  const [approvedClaim, setApprovedClaim] = useState<ClaimRow | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  // Reporter review state
  const [reporterClaims, setReporterClaims] = useState<ReporterClaimDetail[]>([]);
  const [claimsLoadError, setClaimsLoadError] = useState<string | null>(null);

  // Handover state
  const [handover, setHandover] = useState<HandoverDetail | null>(null);
  const [handoverLocationInput, setHandoverLocationInput] = useState<string>(HANDOVER_SPOTS[0]);
  const [handoverTimeInput, setHandoverTimeInput] = useState<string>("");
  const [receiverOtp, setReceiverOtp] = useState<string | null>(null);
  const [fetchingOtp, setFetchingOtp] = useState<boolean>(false);
  const [otpFetchError, setOtpFetchError] = useState<string | null>(null);

  const [otpInput, setOtpInput] = useState<string>("");
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [handoverSuccess, setHandoverSuccess] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchItemData = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    setError(null);
    setClaimsLoadError(null);

    try {
      // 1. Fetch Item
      const { data: rawItemData, error: itemError } = await (supabase
        .from("lost_items") as any)
        .select("*")
        .eq("id", itemId)
        .single();

      const itemData = rawItemData as LostItem | null;

      if (itemError || !itemData) {
        setError("Item not found or has been removed.");
        setItem(null);
        setLoading(false);
        return;
      }

      setItem(itemData);

      // 2. Fetch User Session
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        // 3. Fetch user's own claim if not the reporter
        if (currentUser.id !== itemData.user_id) {
          const { data: rawClaimData } = await (supabase
            .from("claims") as any)
            .select("*")
            .eq("lost_item_id", itemId)
            .eq("claimant_id", currentUser.id)
            .maybeSingle();

          setUserClaim((rawClaimData as ClaimRow) ?? null);
        } else {
          // 4. Fetch incoming claims if reporter
          const { data: claimsData, error: claimsErr } = await (supabase as any).rpc(
            "get_reporter_claims",
            { p_item_id: itemId }
          );

          if (claimsErr) {
            console.error("Error fetching reporter claims:", claimsErr);
            setClaimsLoadError(`Failed to load claims: ${claimsErr.message}`);
            setReporterClaims([]);
          } else if (claimsData && Array.isArray(claimsData)) {
            setReporterClaims(claimsData as ReporterClaimDetail[]);
          } else {
            setReporterClaims([]);
          }
        }

        // 5. Always fetch the approved claim if item is claimed or returned
        if (itemData.status === "claimed" || itemData.status === "returned") {
          const { data: rawApprovedClaim } = await (supabase
            .from("claims") as any)
            .select("*")
            .eq("lost_item_id", itemId)
            .eq("status", "approved")
            .maybeSingle();

          setApprovedClaim((rawApprovedClaim as ClaimRow) ?? null);

          // Fetch active/completed handover details
          const { data: rawHandovers } = await (supabase as any).rpc(
            "get_handover_details",
            { p_item_id: itemId }
          );

          if (rawHandovers && Array.isArray(rawHandovers) && rawHandovers.length > 0) {
            const activeH = rawHandovers[0] as HandoverDetail;
            setHandover(activeH);
          }
        } else {
          setApprovedClaim(null);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load item details."
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchItemData();
  }, [fetchItemData]);

  // Receiver Action: Retrieve OTP
  const handleRetrieveOtp = async () => {
    if (!handover) return;
    setFetchingOtp(true);
    setOtpFetchError(null);

    try {
      const { data: otpCode, error: rpcErr } = await (supabase as any).rpc(
        "get_claimant_otp",
        { p_handover_id: handover.id }
      );

      if (rpcErr) {
        setOtpFetchError(rpcErr.message);
      } else if (otpCode) {
        setReceiverOtp(otpCode as string);
      }
    } catch (err) {
      setOtpFetchError(
        err instanceof Error ? err.message : "Failed to retrieve verification OTP."
      );
    } finally {
      setFetchingOtp(false);
    }
  };

  const handleClaimButtonClick = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setIsClaimModalOpen(true);
  };

  // Reporter Action: Approve Claim via RPC
  const handleApproveClaim = async (claimId: string) => {
    setActionLoading(claimId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const { error: rpcError } = await (supabase as any).rpc("approve_claim", {
        p_claim_id: claimId,
      });

      if (rpcError) {
        setActionError(`Approval failed: ${rpcError.message}`);
      } else {
        setActionSuccess("Claim approved! Handover session can now be arranged.");
        await fetchItemData();
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "An error occurred during approval."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Reporter Action: Reject Claim via RPC
  const handleRejectClaim = async (claimId: string) => {
    setActionLoading(claimId);
    setActionError(null);
    setActionSuccess(null);

    try {
      const { error: rpcError } = await (supabase as any).rpc("reject_claim", {
        p_claim_id: claimId,
      });

      if (rpcError) {
        setActionError(`Rejection failed: ${rpcError.message}`);
      } else {
        setActionSuccess("Claim rejected.");
        await fetchItemData();
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "An error occurred during rejection."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Physical Holder Action: Arrange & Start Handover Session
  const handleStartHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandoverError(null);
    setHandoverSuccess(null);

    if (!handoverLocationInput.trim()) {
      setHandoverError("Handover location is required.");
      return;
    }

    // Determine target approved claim_id:
    const targetClaim = approvedClaim || userClaim || reporterClaims.find((c) => c.status === "approved");
    const targetClaimId = targetClaim?.id;

    if (!targetClaimId) {
      setHandoverError("No approved claim found to arrange handover.");
      return;
    }

    const handoverLocation = handoverLocationInput.trim();
    const preferredTime = handoverTimeInput.trim() || null;

    setHandoverSubmitting(true);

    try {
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        "start_handover",
        {
          p_claim_id: targetClaimId,
          p_handover_location: handoverLocation,
          p_preferred_time: preferredTime,
        }
      );

      if (rpcErr) {
        setHandoverError(`Failed to arrange handover: ${rpcErr.message}`);
      } else {
        setHandoverSuccess(
          "Handover session initiated! The receiver can now retrieve their verification OTP. Meet in person on campus to verify."
        );
        await fetchItemData();
      }
    } catch (err) {
      setHandoverError(
        err instanceof Error ? err.message : "Failed to start handover."
      );
    } finally {
      setHandoverSubmitting(false);
    }
  };

  // Physical Holder Action: Verify Receiver's OTP Code
  const handleVerifyHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandoverError(null);
    setHandoverSuccess(null);

    const trimmedOtp = otpInput.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setHandoverError("Please enter the 6-digit OTP code provided by the receiver.");
      return;
    }

    if (!handover) {
      setHandoverError("No active handover session found.");
      return;
    }

    setHandoverSubmitting(true);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("verify_handover", {
        p_handover_id: handover.id,
        p_otp: trimmedOtp,
      });

      if (rpcErr) {
        setHandoverError(rpcErr.message);
      } else {
        setHandoverSuccess("OTP verified! Handover completed and item status updated to RETURNED.");
        setOtpInput("");
        await fetchItemData();
      }
    } catch (err) {
      setHandoverError(
        err instanceof Error ? err.message : "Failed to verify handover."
      );
    } finally {
      setHandoverSubmitting(false);
    }
  };

  // Physical Holder Action: Cancel Handover Session
  const handleCancelHandover = async () => {
    if (!handover) return;

    setHandoverError(null);
    setHandoverSubmitting(true);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("cancel_handover", {
        p_handover_id: handover.id,
        p_reason: "Cancelled by physical holder",
      });

      if (rpcErr) {
        setHandoverError(`Cancel failed: ${rpcErr.message}`);
      } else {
        setReceiverOtp(null);
        setHandover(null);
        setHandoverSuccess("Handover session cancelled.");
        await fetchItemData();
      }
    } catch (err) {
      setHandoverError(
        err instanceof Error ? err.message : "Failed to cancel handover."
      );
    } finally {
      setHandoverSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-6 space-y-4">
            <div className="h-64 w-full rounded-xl animate-shimmer" />
            <div className="h-6 w-1/3 rounded animate-shimmer" />
            <div className="h-4 w-2/3 rounded animate-shimmer" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#C94A4A] mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-[#171717]">Item Not Found</h1>
            <p className="mt-1 text-xs text-[#6B6B67]">
              {error || "The item you are looking for does not exist or has been removed."}
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
            >
              Back to Lost &amp; Found
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isReporter = user?.id === item.user_id;
  const isApprovedClaimant = user?.id === (approvedClaim?.claimant_id || userClaim?.claimant_id);
  const itemType = item.item_type || (item.status === "found" ? "found" : "lost");

  // Derive roles based on report direction (item_type):
  // FOUND item: reporter has physical item (holder), claimant is receiving (receiver)
  // LOST item: claimant has physical item (holder), reporter is receiving (receiver)
  const isPhysicalHolder = itemType === "found"
    ? isReporter
    : isApprovedClaimant;

  const isReceiver = itemType === "found"
    ? isApprovedClaimant
    : isReporter;

  const originalDirection = itemType.toUpperCase();

  // Status Display: Combine original report direction AND current state
  const statusLabel =
    item.status === "claimed"
      ? `${originalDirection} • CLAIMED`
      : item.status === "returned"
      ? `${originalDirection} • RETURNED`
      : originalDirection;

  const statusBadgeStyle =
    item.status === "returned"
      ? "bg-emerald-50 text-[#4F7C68] border-emerald-200"
      : item.status === "claimed"
      ? "bg-amber-50 text-[#B88A3B] border-amber-200"
      : originalDirection === "LOST"
      ? "bg-red-50 text-[#C94A4A] border-red-200"
      : "bg-emerald-50 text-[#4F7C68] border-emerald-200";

  const formattedIncidentDate = item.incident_at
    ? formatFullDate(item.incident_at)
    : "Not specified";

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6B67] transition hover:text-[#7A1F2B]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Lost &amp; Found
          </Link>
        </div>

        {/* Item Card Container */}
        <article className="overflow-hidden rounded-2xl border border-[#E8E6E1] bg-white shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Image Column */}
            <div className="relative aspect-[4/3] md:aspect-auto w-full bg-[#FAFAF8] flex items-center justify-center border-b md:border-b-0 md:border-r border-[#E8E6E1]">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#6B6B67]">
                  <svg className="h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <span className="text-xs font-medium">No photo available</span>
                </div>
              )}

              <span
                className={`absolute left-3 top-3 rounded-md border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${statusBadgeStyle}`}
              >
                {statusLabel}
              </span>
            </div>

            {/* Details Column */}
            <div className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B67] uppercase tracking-wider mb-2">
                  <span>{item.category}</span>
                  <span>{getRelativeTime(item.created_at)}</span>
                </div>

                <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
                  {item.title}
                </h1>

                <div className="mt-4 space-y-2 text-xs border-t border-[#E8E6E1] pt-4">
                  <div className="flex items-center gap-2 text-[#171717]">
                    <span className="font-medium text-[#6B6B67] w-24">Location:</span>
                    <span className="font-semibold">{item.campus_location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#171717]">
                    <span className="font-medium text-[#6B6B67] w-24">Date &amp; Time:</span>
                    <span>{formattedIncidentDate}</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#E8E6E1] pt-4">
                  <h3 className="text-xs font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                    Description
                  </h3>
                  <p className="text-xs text-[#171717] leading-relaxed whitespace-pre-line">
                    {item.description || "No additional description provided."}
                  </p>
                </div>
              </div>

              {/* Claim Action Box */}
              <div className="mt-6 border-t border-[#E8E6E1] pt-4">
                {item.status === "returned" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-center text-xs font-medium text-[#4F7C68]">
                    ✓ RETURNED — This item was physically handed over to its verified owner.
                  </div>
                ) : item.status === "claimed" ? (
                  isPhysicalHolder || isReceiver ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-center text-xs font-medium text-[#B88A3B]">
                      CLAIM APPROVED — Ready for physical handover on campus. Scroll down to manage handover.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-center text-xs font-medium text-[#B88A3B]">
                      CLAIMED — This item is currently being returned to its verified owner.
                    </div>
                  )
                ) : isReporter ? (
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3 text-center text-xs font-medium text-[#6B6B67]">
                    You reported this item. Scroll down to review incoming claims.
                  </div>
                ) : userClaim ? (
                  <div
                    className={`rounded-xl border p-3.5 text-center text-xs font-medium ${
                      userClaim.status === "approved"
                        ? "border-emerald-200 bg-emerald-50 text-[#4F7C68]"
                        : userClaim.status === "rejected"
                        ? "border-red-200 bg-red-50 text-[#C94A4A]"
                        : "border-blue-200 bg-blue-50 text-blue-800"
                    }`}
                  >
                    {userClaim.status === "approved" && "Your claim was approved! Scroll down to manage physical handover."}
                    {userClaim.status === "rejected" && "Your claim was reviewed and rejected."}
                    {userClaim.status === "pending" && "Your claim is pending review."}
                  </div>
                ) : (
                  <button
                    onClick={handleClaimButtonClick}
                    className="w-full rounded-xl bg-[#7A1F2B] py-3 text-xs font-bold text-white shadow-2xs transition hover:bg-[#631822] focus:outline-none"
                  >
                    Claim This Item
                  </button>
                )}
              </div>
            </div>
          </div>
        </article>

        {/* SECURE PHYSICAL HANDOVER SECTION */}
        {(item.status === "claimed" || item.status === "returned") && (isPhysicalHolder || isReceiver) && (
          <section className="mt-8 rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-2xs animate-fade-in">
            <div className="border-b border-[#E8E6E1] pb-3 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#171717]">
                  Physical Handover
                </h2>
                <p className="text-xs text-[#6B6B67]">
                  {isPhysicalHolder
                    ? "You currently have this item. Arrange a meeting with the receiver."
                    : "The person holding your item has arranged the physical handover."}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                  item.status === "returned"
                    ? "bg-emerald-50 text-[#4F7C68] border-emerald-200"
                    : "bg-amber-50 text-[#B88A3B] border-amber-200"
                }`}
              >
                {item.status === "returned" ? "RETURNED" : "HANDOVER IN PROGRESS"}
              </span>
            </div>

            {handoverError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-[#C94A4A]">
                {handoverError}
              </div>
            )}

            {handoverSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-[#4F7C68]">
                {handoverSuccess}
              </div>
            )}

            {item.status === "returned" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-[#4F7C68] space-y-1">
                <p className="font-bold text-sm">✓ Physical Handover Completed</p>
                <p>This item was physically handed over and verified via cryptographic 6-digit OTP.</p>
                {handover?.completed_at && (
                  <p className="text-[10px] opacity-80 pt-1 border-t border-emerald-200/60">
                    Handover verified at: {formatFullDate(handover.completed_at)}
                  </p>
                )}
              </div>
            ) : isPhysicalHolder ? (
              /* PHYSICAL HOLDER VIEW: ARRANGES HANDOVER / ENTERS RECEIVER'S OTP */
              <div className="space-y-4 text-xs">
                {!handover || handover.status === "cancelled" || handover.status === "expired" ? (
                  <form onSubmit={handleStartHandover} className="space-y-4">
                    <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-4 space-y-3">
                      <h3 className="font-bold text-[#171717]">Step 1: Arrange Handover Location &amp; Schedule</h3>
                      <p className="text-[#6B6B67]">
                        Select an agreed campus location and time to meet the receiver.
                      </p>

                      <div>
                        <label htmlFor="handoverSpot" className="block font-semibold text-[#171717] mb-1">
                          Meeting Location <span className="text-[#C94A4A]">*</span>
                        </label>
                        <select
                          id="handoverSpot"
                          value={handoverLocationInput}
                          onChange={(e) => setHandoverLocationInput(e.target.value)}
                          className="w-full rounded-lg border border-[#E8E6E1] bg-white p-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
                        >
                          {HANDOVER_SPOTS.map((spot) => (
                            <option key={spot} value={spot}>
                              {spot}
                            </option>
                          ))}
                          {CAMPUS_LOCATIONS.filter((l) => l !== "All Locations").map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="handoverTime" className="block font-semibold text-[#171717] mb-1">
                          Preferred Time <span className="text-[10px] font-normal text-[#6B6B67]">(Optional)</span>
                        </label>
                        <input
                          id="handoverTime"
                          type="text"
                          value={handoverTimeInput}
                          onChange={(e) => setHandoverTimeInput(e.target.value)}
                          placeholder="e.g. Today at 3:30 PM after lecture"
                          className="w-full rounded-lg border border-[#E8E6E1] bg-white p-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={handoverSubmitting}
                      className="rounded-xl bg-[#7A1F2B] px-5 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#631822] disabled:opacity-50"
                    >
                      {handoverSubmitting ? "Initializing Handover..." : "Start Handover"}
                    </button>
                  </form>
                ) : (
                  /* ACTIVE HANDOVER PHYSICAL HOLDER VIEW: ENTER RECEIVER'S OTP */
                  <form onSubmit={handleVerifyHandover} className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <h3 className="font-bold text-[#171717]">Handover Session Active</h3>
                      <div className="space-y-1 text-xs text-[#171717]">
                        <p><span className="font-semibold text-[#6B6B67]">Meeting Location:</span> {handover.handover_location}</p>
                        {handover.preferred_time && (
                          <p><span className="font-semibold text-[#6B6B67]">Preferred Time:</span> {handover.preferred_time}</p>
                        )}
                      </div>

                      <p className="text-[#6B6B67]">
                        The receiver must provide their 6-digit verification code during the physical handover.
                      </p>

                      <div>
                        <label htmlFor="otpCodeInput" className="block font-semibold text-[#171717] mb-1">
                          Enter Receiver&apos;s 6-Digit Verification Code <span className="text-[#C94A4A]">*</span>
                        </label>
                        <input
                          id="otpCodeInput"
                          type="text"
                          maxLength={6}
                          required
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                          placeholder="Enter 6-digit OTP..."
                          className="w-full max-w-xs font-mono tracking-widest text-base rounded-lg border border-[#E8E6E1] bg-white p-2.5 text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="submit"
                        disabled={handoverSubmitting || otpInput.length !== 6}
                        className="rounded-xl bg-[#4F7C68] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {handoverSubmitting ? "Verifying..." : "Enter OTP & Complete Handover"}
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelHandover}
                        disabled={handoverSubmitting}
                        className="text-xs font-semibold text-[#C94A4A] hover:underline"
                      >
                        Cancel Session
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* RECEIVER VIEW: RETRIEVES & DISPLAYS THEIR 6-DIGIT OTP */
              <div className="space-y-4 text-xs">
                {handover?.status === "active" ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#171717]">Handover Session Active</span>
                        <span className="text-[10px] font-bold text-[#B88A3B] uppercase">Awaiting Meeting</span>
                      </div>
                      <div className="space-y-1 text-xs text-[#171717]">
                        <p><span className="font-semibold text-[#6B6B67]">Meeting Location:</span> {handover.handover_location}</p>
                        {handover.preferred_time && (
                          <p><span className="font-semibold text-[#6B6B67]">Preferred Time:</span> {handover.preferred_time}</p>
                        )}
                      </div>

                      <p className="text-[#6B6B67]">
                        At the meeting, give your verification code to the person holding your item.
                      </p>

                      {otpFetchError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-[#C94A4A]">
                          {otpFetchError}
                        </div>
                      )}

                      {/* Display 6-digit OTP code to Receiver */}
                      {receiverOtp ? (
                        <div className="rounded-lg border border-[#7A1F2B]/20 bg-white p-4 text-center">
                          <span className="text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider block mb-1">
                            Your Verification Code
                          </span>
                          <span className="text-3xl font-mono font-extrabold text-[#7A1F2B] tracking-widest block my-2">
                            {receiverOtp}
                          </span>
                          <p className="text-[11px] text-[#6B6B67]">
                            Give this 6-digit code to the person holding your item <span className="font-bold text-[#C94A4A]">only when the physical item is being handed over</span>.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[#E8E6E1] bg-white p-4 text-center space-y-2">
                          <button
                            type="button"
                            onClick={handleRetrieveOtp}
                            disabled={fetchingOtp}
                            className="rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#631822] disabled:opacity-50"
                          >
                            {fetchingOtp ? "Retrieving..." : "Retrieve Verification OTP"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-4 text-center text-[#6B6B67]">
                    Awaiting the person holding the item to arrange the physical handover location and schedule.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Reporter Review Section */}
        {isReporter && item.status !== "returned" && (
          <section className="mt-8 rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-2xs animate-fade-in">
            <div className="border-b border-[#E8E6E1] pb-3 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#171717]">
                  Incoming Claims Review
                </h2>
                <p className="text-xs text-[#6B6B67]">
                  Review verification details submitted by students. Approve the rightful claimant.
                </p>
              </div>
              <span className="rounded-full bg-[#F6EDEF] border border-[#7A1F2B]/15 px-2.5 py-0.5 text-xs font-bold text-[#7A1F2B]">
                {reporterClaims.length} Claim{reporterClaims.length !== 1 ? "s" : ""}
              </span>
            </div>

            {claimsLoadError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-[#C94A4A]">
                {claimsLoadError}
              </div>
            )}

            {actionError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-[#C94A4A]">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-[#4F7C68]">
                {actionSuccess}
              </div>
            )}

            {reporterClaims.length === 0 ? (
              <p className="text-xs text-[#6B6B67] text-center py-6">
                No claims submitted for this item yet.
              </p>
            ) : (
              <div className="space-y-4">
                {reporterClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#171717]">
                          {claim.claimant_full_name || "Student Claimant"}
                        </span>
                        {claim.claimant_admission_number && (
                          <span className="font-mono text-[10px] font-semibold text-[#7A1F2B]">
                            ({claim.claimant_admission_number})
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          claim.status === "approved"
                            ? "bg-emerald-100 text-[#4F7C68]"
                            : claim.status === "rejected"
                            ? "bg-red-100 text-[#C94A4A]"
                            : "bg-amber-100 text-[#B88A3B]"
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#171717] bg-white p-3 rounded-lg border border-[#E8E6E1]">
                      &quot;{claim.message}&quot;
                    </p>

                    {claim.proof_image_url && (
                      <div>
                        <span className="text-[10px] font-bold text-[#6B6B67] uppercase block mb-1">
                          Proof Photo:
                        </span>
                        <img
                          src={claim.proof_image_url}
                          alt="Claim proof"
                          className="h-24 w-24 object-cover rounded-lg border border-[#E8E6E1]"
                        />
                      </div>
                    )}

                    {claim.status === "pending" && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E6E1]">
                        <button
                          onClick={() => handleRejectClaim(claim.id)}
                          disabled={actionLoading === claim.id}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#C94A4A] hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveClaim(claim.id)}
                          disabled={actionLoading === claim.id}
                          className="rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#631822] disabled:opacity-50"
                        >
                          Approve Claim
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* AI Hybrid Match Suggestions */}
        {item && <AIMatchSuggestions itemId={item.id} />}
      </main>

      {/* Claim Submission Modal */}
      {item && isClaimModalOpen && (
        <ClaimModal
          itemId={item.id}
          itemTitle={item.title}
          onClose={() => setIsClaimModalOpen(false)}
          onSuccess={fetchItemData}
        />
      )}
    </div>
  );
}
