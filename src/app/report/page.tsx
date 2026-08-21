"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import type { User } from "@supabase/supabase-js";
import type { Database, ItemStatus } from "@/types/database";
import TimeInput12Hour from "@/components/TimeInput12Hour";
import { convert12HourTo24Hour, validate12HourTime } from "@/lib/timeUtils";

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
  const [incidentTime, setIncidentTime] = useState<string>("12:00 PM");
  const [isTimeApproximate, setIsTimeApproximate] = useState<boolean>(true);

  // Multi-photo state (Up to 5 images)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

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

  // Update object URLs when selectedFiles changes
  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB per file

    // Check maximum total images limit (5)
    if (selectedFiles.length + files.length > 5) {
      setError(`You can upload a maximum of 5 images. You already have ${selectedFiles.length} selected.`);
      return;
    }

    const newValidFiles: File[] = [];
    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        setError(`Unsupported format (${file.name}). Please select JPEG, PNG, or WEBP images.`);
        return;
      }
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds 5MB size limit.`);
        return;
      }
      newValidFiles.push(file);
    }

    setSelectedFiles((prev) => [...prev, ...newValidFiles]);
    // Reset the input value so selecting the same file again works
    e.target.value = "";
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
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

    if (!validate12HourTime(incidentTime)) {
      setError("Please select or enter a valid 12-hour time format (e.g. 02:05 PM).");
      return;
    }

    const time24 = convert12HourTo24Hour(incidentTime) || "12:00";
    const combinedDate = new Date(`${incidentDate}T${time24}:00`);

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
      let primaryImageUrl: string | null = null;
      const additionalImageUrls: string[] = [];

      // 1. Upload photos if provided (up to 5)
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const fileExt = file.name.split(".").pop() || "jpg";
          const sanitizedFileName = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
          const filePath = `${user.id}/${sanitizedFileName}`;

          const { error: uploadError } = await supabase.storage
            .from("item-photos")
            .upload(filePath, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            console.warn(`Storage upload warning on file ${i + 1}:`, uploadError);
            setError(`Photo upload failed for image ${i + 1}: ${uploadError.message}. Please try again.`);
            setSubmitting(false);
            return;
          }

          const { data: publicUrlData } = supabase.storage
            .from("item-photos")
            .getPublicUrl(filePath);

          const publicUrl = publicUrlData?.publicUrl || null;
          if (publicUrl) {
            if (i === 0) {
              primaryImageUrl = publicUrl;
            } else {
              additionalImageUrls.push(publicUrl);
            }
          }
        }
      }

      // 2. Insert into public.lost_items
      const insertPayload: Database["public"]["Tables"]["lost_items"]["Insert"] = {
        user_id: user.id,
        title: trimmedTitle,
        description: trimmedDesc,
        category,
        campus_location: campusLocation,
        incident_at: incidentAtISO,
        image_url: primaryImageUrl,
        additional_images: additionalImageUrls,
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
              imageUrl: primaryImageUrl || undefined,
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
            Zeteo Campus Portal
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
              Your item is now visible in the Zeteo Lost &amp; Found hub to help reunite it with its owner.
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
                      Time (12-Hour) <span className="text-[10px] font-normal text-[#6B6B67]">(Approximate is fine)</span>
                    </label>
                    <TimeInput12Hour value={incidentTime} onChange={setIncidentTime} id="incidentTime" />
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

              {/* Section 5: Photos */}
              <div className="space-y-4 border-t border-[#E8E6E1] pt-5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-[#6B6B67] uppercase tracking-wider">
                    5. Photos <span className="text-[10px] font-normal text-[#6B6B67] uppercase">(Optional)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-[#6B6B67]">
                    {selectedFiles.length} / 5 images
                  </span>
                </div>

                {previewUrls.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {previewUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className={`relative aspect-[4/3] rounded-xl overflow-hidden border ${
                            idx === 0
                              ? "border-[#7A1F2B] ring-2 ring-[#7A1F2B]/15"
                              : "border-[#E8E6E1]"
                          } bg-[#FAFAF8] group`}
                        >
                          <img
                            src={url}
                            alt={`Preview ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />

                          {/* Primary Cover Badge */}
                          {idx === 0 && (
                            <span className="absolute left-1.5 top-1.5 rounded bg-[#7A1F2B] px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider shadow-2xs">
                              Primary / Cover
                            </span>
                          )}

                          {/* Individual Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(idx)}
                            aria-label={`Remove photo ${idx + 1}`}
                            className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white opacity-90 transition hover:bg-[#C94A4A] hover:opacity-100"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      {/* Add more tile if under 5 images */}
                      {selectedFiles.length < 5 && (
                        <label
                          htmlFor="photoUploadMore"
                          className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#E8E6E1] bg-[#FAFAF8] p-3 text-center transition hover:border-[#7A1F2B] hover:bg-white"
                        >
                          <svg className="h-5 w-5 text-[#6B6B67] mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          <span className="text-[11px] font-semibold text-[#171717]">
                            Add photo
                          </span>
                          <span className="text-[9px] text-[#6B6B67]">
                            ({5 - selectedFiles.length} slots left)
                          </span>
                        </label>
                      )}
                    </div>

                    <input
                      id="photoUploadMore"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFilesChange}
                      className="hidden"
                    />
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
                        Click to upload photos (Up to 5 images)
                      </span>
                      <span className="mt-0.5 text-[10px] text-[#6B6B67]">
                        JPEG, PNG, or WEBP (Max 5MB per image). First image is cover.
                      </span>
                    </label>
                    <input
                      id="photoUpload"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFilesChange}
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
