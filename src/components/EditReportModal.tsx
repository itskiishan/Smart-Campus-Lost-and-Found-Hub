"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LostItem } from "@/types/database";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import TimeInput12Hour from "@/components/TimeInput12Hour";
import {
  convert12HourTo24Hour,
  isoTo12HourTime,
  isoToDateInput,
  validate12HourTime,
} from "@/lib/timeUtils";

interface EditReportModalProps {
  item: LostItem;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const CATEGORIES = [
  "Electronics & Gadgets",
  "Identity & Cards",
  "Keys & Access",
  "Bags & Backpacks",
  "Wallets & Purses",
  "Books & Stationery",
  "Clothing & Accessories",
  "Water Bottles",
  "Eyewear",
  "Other Campus Items",
];

export default function EditReportModal({
  item,
  onClose,
  onSuccess,
}: EditReportModalProps) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category || CATEGORIES[0]);
  const [description, setDescription] = useState(item.description || "");
  const [location, setLocation] = useState(item.campus_location || CAMPUS_LOCATIONS[0]);
  
  const [incidentDate, setIncidentDate] = useState(isoToDateInput(item.incident_at));
  const [incidentTime, setIncidentTime] = useState(isoTo12HourTime(item.incident_at));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.image_url || null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Unsupported image type. Please select JPEG, PNG, or WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size exceeds 5MB limit.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Item title is required.");
      return;
    }

    if (!incidentDate) {
      setError("Incident date is required.");
      return;
    }

    if (!validate12HourTime(incidentTime)) {
      setError("Please provide a valid 12-hour time format (e.g. 02:05 PM).");
      return;
    }

    const time24 = convert12HourTo24Hour(incidentTime);
    if (!time24) {
      setError("Invalid time selection.");
      return;
    }

    const combinedDate = new Date(`${incidentDate}T${time24}:00`);
    if (isNaN(combinedDate.getTime())) {
      setError("Invalid date/time combination.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== item.user_id) {
        setError("Unauthorized: Only the report owner can edit this report.");
        setSubmitting(false);
        return;
      }

      let updatedImageUrl = item.image_url;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop() || "jpg";
        const sanitizedFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `${user.id}/items/${sanitizedFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("items")
          .upload(filePath, selectedFile, { upsert: false });

        if (uploadErr) {
          setError(`Image upload failed: ${uploadErr.message}`);
          setSubmitting(false);
          return;
        }

        const { data: pubUrlData } = supabase.storage
          .from("items")
          .getPublicUrl(filePath);

        updatedImageUrl = pubUrlData?.publicUrl || null;
      }

      const updatePayload = {
        title: trimmedTitle,
        category,
        description: description.trim() || null,
        campus_location: location,
        incident_at: combinedDate.toISOString(),
        image_url: updatedImageUrl,
        updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await (supabase
        .from("lost_items") as any)
        .update(updatePayload)
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (updateErr) {
        setError(`Failed to update report: ${updateErr.message}`);
      } else {
        await onSuccess();
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred while updating the report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-md animate-dropdown">
        <div className="flex items-start justify-between border-b border-[#E8E6E1] pb-3 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#171717]">
              Edit Report
            </h2>
            <p className="text-xs text-[#6B6B67]">
              Update item details, location, date, time, or photo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block font-bold text-[#171717] mb-1">Title / Item Name *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block font-bold text-[#171717] mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Campus Location */}
          <div>
            <label className="block font-bold text-[#171717] mb-1">Campus Location *</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
            >
              {CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Incident Date & 12-Hour Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#171717] mb-1">Date *</label>
              <input
                type="date"
                required
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#171717] mb-1">Time (12-Hour) *</label>
              <TimeInput12Hour value={incidentTime} onChange={setIncidentTime} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-[#171717] mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block font-bold text-[#171717] mb-1">Item Photo</label>
            {previewUrl && (
              <div className="mb-2 relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-[#E8E6E1] bg-[#FAFAF8]">
                <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="w-full text-xs text-[#6B6B67] file:mr-3 file:rounded-xl file:border-0 file:bg-[#7A1F2B] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-[#631822]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E8E6E1]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E8E6E1] bg-white px-4 py-2 text-xs font-semibold text-[#6B6B67] hover:bg-[#FAFAF8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#7A1F2B] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#631822] disabled:opacity-50"
            >
              {submitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
