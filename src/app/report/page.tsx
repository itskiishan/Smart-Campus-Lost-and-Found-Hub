"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import type { User } from "@supabase/supabase-js";
import type { Database, ItemStatus } from "@/types/database";

const REPORT_CATEGORIES = [
  "Electronics",
  "Wallet / Money",
  "ID / Cards",
  "Keys",
  "Books / Stationery",
  "Clothing / Accessories",
  "Bags",
  "Water Bottles",
  "Documents",
  "Other",
] as const;

export default function ReportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Form states
  const [statusType, setStatusType] = useState<"lost" | "found">("lost");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState("");

  // Location selection based on CAMPUS_LOCATIONS single source of truth
  const validLocations = CAMPUS_LOCATIONS.filter((loc) => loc !== "All Locations");
  const [campusLocation, setCampusLocation] = useState<string>(validLocations[0]);

  // Date and Time
  const todayStr = new Date().toISOString().split("T")[0];
  const [incidentDate, setIncidentDate] = useState<string>(todayStr);
  const [incidentTime, setIncidentTime] = useState<string>("");
  const [isTimeApproximate, setIsTimeApproximate] = useState<boolean>(true);

  // Photo state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
      }
      setLoadingUser(false);
    });
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Unsupported image type. Please select a JPEG, PNG, or WEBP image.");
      return;
    }

    // Validate max size 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Image file is too large. Maximum allowed size is 5MB.");
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be logged in to report an item.");
      return;
    }

    // Validate Title
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Item name is required.");
      return;
    }

    // Validate Description
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError("Description is required.");
      return;
    }

    // Validate Location
    if (!campusLocation || !validLocations.includes(campusLocation as any)) {
      setError("Please select a valid campus location.");
      return;
    }

    // Validate Date & Time
    if (!incidentDate) {
      setError("Incident date is required.");
      return;
    }

    const timeString = incidentTime ? incidentTime : "00:00";
    const combinedDate = new Date(`${incidentDate}T${timeString}:00`);

    if (isNaN(combinedDate.getTime())) {
      setError("Invalid incident date or time format.");
      return;
    }

    if (combinedDate > new Date()) {
      setError("Incident date/time cannot be in the future.");
      return;
    }

    const incidentAtISO = combinedDate.toISOString();
    const statusVal: ItemStatus = statusType;

    setSubmitting(true);

    try {
      let uploadedImageUrl: string | null = null;

      // 1. Upload photo if provided
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop() || "jpg";
        const sanitizedFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `${user.id}/${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("item-photos")
          .upload(filePath, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) {
          console.warn("Storage upload warning:", uploadError);
          setError(`Photo upload failed: ${uploadError.message}. Please try again or submit without a photo.`);
          setSubmitting(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("item-photos")
          .getPublicUrl(filePath);

        uploadedImageUrl = publicUrlData?.publicUrl || null;
      }

      // 2. Insert into public.lost_items
      const insertPayload: Database["public"]["Tables"]["lost_items"]["Insert"] = {
        user_id: user.id,
        title: trimmedTitle,
        description: trimmedDesc,
        category,
        campus_location: campusLocation,
        incident_at: incidentAtISO,
        image_url: uploadedImageUrl,
        status: statusVal,
        item_type: statusVal,
      };

      const { data: insertedItem, error: insertError } = await (supabase
        .from("lost_items") as any)
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) {
        setError(`Failed to submit report: ${insertError.message}`);
      } else {
        setSuccess(true);

        // 3. Fail-safe non-blocking CLIP embedding generation trigger
        if (insertedItem?.id) {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;

          fetch("/api/embed", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              itemId: insertedItem.id,
              imageUrl: uploadedImageUrl || undefined,
            }),
          }).catch((embedErr) => {
            console.warn("Non-blocking AI embedding notice:", embedErr);
          });
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while submitting your report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] text-[#6B6B67]">
        <div className="flex items-center gap-2 text-xs font-medium">
          <svg className="h-4 w-4 animate-spin text-[#7A1F2B]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Verifying session...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E8E6E1] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6B67] transition hover:text-[#7A1F2B]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Lost &amp; Found
          </Link>
          <span className="text-xs font-bold text-[#7A1F2B] uppercase tracking-wider">
            ABESEC Campus Portal
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {success ? (
          /* Success Screen */
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-8 text-center shadow-2xs animate-fade-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#4F7C68] mb-4 border border-emerald-200/60">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
              Report submitted successfully
            </h1>
            <p className="mt-2 text-xs text-[#6B6B67] max-w-md mx-auto leading-relaxed">
              Your item is now visible in the ABESEC Lost &amp; Found hub to help reunite it with its owner.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/"
                className="rounded-lg bg-[#7A1F2B] px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
              >
                Back to Lost &amp; Found
              </Link>
            </div>
          </div>
        ) : (
          /* Modern Product Multi-Section Form */
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-2xs sm:p-8">
            <div className="border-b border-[#E8E6E1] pb-4 mb-6">
              <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
                Report an Item
              </h1>
              <p className="mt-1 text-xs text-[#6B6B67]">
                Help reunite a lost item with its rightful owner on campus.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-[#C94A4A]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: What Happened? */}
              <div>
                <label className="block text-[11px] font-bold text-[#6B6B67] uppercase tracking-wider mb-2">
                  1. What happened?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatusType("lost")}
                    className={`rounded-xl border py-3 px-4 text-xs font-bold transition flex flex-col items-center gap-1 ${
                      statusType === "lost"
                        ? "border-[#7A1F2B] bg-[#F6EDEF] text-[#7A1F2B] shadow-2xs"
                        : "border-[#E8E6E1] bg-[#FAFAF8] text-[#6B6B67] hover:border-[#7A1F2B]/30 hover:text-[#171717]"
                    }`}
                  >
                    <span>I LOST SOMETHING</span>
                    <span className="text-[10px] font-normal opacity-80">Report a missing item</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusType("found")}
                    className={`rounded-xl border py-3 px-4 text-xs font-bold transition flex flex-col items-center gap-1 ${
                      statusType === "found"
                        ? "border-emerald-600 bg-emerald-50 text-[#4F7C68] shadow-2xs"
                        : "border-[#E8E6E1] bg-[#FAFAF8] text-[#6B6B67] hover:border-emerald-400 hover:text-[#171717]"
                    }`}
                  >
                    <span>I FOUND SOMETHING</span>
                    <span className="text-[10px] font-normal opacity-80">Report an item you found</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Item Details */}
              <div className="space-y-4 border-t border-[#E8E6E1] pt-5">
                <label className="block text-[11px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                  2. Item details
                </label>

                <div>
                  <label htmlFor="title" className="block text-xs font-semibold text-[#171717] mb-1">
                    Item Name <span className="text-[#C94A4A]">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Black leather wallet, Blue Milton bottle, AirPods Pro"
                    className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-xs font-semibold text-[#171717] mb-1">
                    Category <span className="text-[#C94A4A]">*</span>
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                  >
                    {REPORT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="description" className="block text-xs font-semibold text-[#171717] mb-1">
                    Description <span className="text-[#C94A4A]">*</span>
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    maxLength={1000}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the item, including color, brand, unique markings, or identifying features..."
                    className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                  />
                  <p className="mt-1 text-[10px] text-[#6B6B67] text-right">
                    {description.length}/1000 characters
                  </p>
                </div>
              </div>

              {/* Section 3: Where? */}
              <div className="space-y-4 border-t border-[#E8E6E1] pt-5">
                <label className="block text-[11px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                  3. Where?
                </label>

                <div>
                  <label htmlFor="campusLocation" className="block text-xs font-semibold text-[#171717] mb-1">
                    Campus Location <span className="text-[#C94A4A]">*</span>
                  </label>
                  <select
                    id="campusLocation"
                    value={campusLocation}
                    onChange={(e) => setCampusLocation(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                  >
                    {validLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 4: When? */}
              <div className="space-y-4 border-t border-[#E8E6E1] pt-5">
                <label className="block text-[11px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                  4. When?
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="incidentDate" className="block text-xs font-semibold text-[#171717] mb-1">
                      Incident Date <span className="text-[#C94A4A]">*</span>
                    </label>
                    <input
                      id="incidentDate"
                      type="date"
                      max={todayStr}
                      required
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                    />
                  </div>

                  <div>
                    <label htmlFor="incidentTime" className="block text-xs font-semibold text-[#171717] mb-1">
                      Time <span className="text-[10px] font-normal text-[#6B6B67]">(Approximate is fine)</span>
                    </label>
                    <input
                      id="incidentTime"
                      type="time"
                      value={incidentTime}
                      onChange={(e) => setIncidentTime(e.target.value)}
                      className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="approxTimeCheck"
                    type="checkbox"
                    checked={isTimeApproximate}
                    onChange={(e) => setIsTimeApproximate(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#E8E6E1] text-[#7A1F2B] focus:ring-[#7A1F2B]"
                  />
                  <label htmlFor="approxTimeCheck" className="text-xs text-[#6B6B67]">
                    This date &amp; time is an estimate
                  </label>
                </div>
              </div>

              {/* Section 5: Photo */}
              <div className="space-y-4 border-t border-[#E8E6E1] pt-5">
                <label className="block text-[11px] font-bold text-[#6B6B67] uppercase tracking-wider mb-1">
                  5. Photo <span className="text-[10px] font-normal text-[#6B6B67] uppercase">(Optional)</span>
                </label>

                {imagePreviewUrl ? (
                  <div className="relative aspect-[16/9] w-full max-w-sm overflow-hidden rounded-xl border border-[#E8E6E1] bg-[#FAFAF8]">
                    <img
                      src={imagePreviewUrl}
                      alt="Selected preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute right-2 top-2 rounded-lg bg-[#C94A4A] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="photoUpload"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E6E1] bg-[#FAFAF8] p-6 text-center transition hover:border-[#7A1F2B]"
                    >
                      <svg
                        className="h-7 w-7 text-[#6B6B67] mb-1.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-[#171717]">
                        Click to upload photo
                      </span>
                      <span className="mt-0.5 text-[10px] text-[#6B6B67]">
                        JPEG, PNG, or WEBP (Max 5MB)
                      </span>
                    </label>
                    <input
                      id="photoUpload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-[#E8E6E1]">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#7A1F2B] py-3 text-xs font-bold text-white shadow-2xs transition hover:bg-[#631822] focus:outline-none disabled:opacity-50"
                >
                  {submitting ? "Submitting Report..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
