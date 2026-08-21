"use client";

import { useEffect, useState } from "react";
import { parse12HourTime, validate12HourTime } from "@/lib/timeUtils";

interface TimeInput12HourProps {
  value: string; // "HH:MM AM/PM"
  onChange: (value: string) => void;
  id?: string;
  error?: string | null;
}

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

export default function TimeInput12Hour({
  value,
  onChange,
  id = "timeInput12Hour",
  error,
}: TimeInput12HourProps) {
  const parsed = parse12HourTime(value) || { hour: "12", minute: "00", period: "PM" };

  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(parsed.period);
  const [manualText, setManualText] = useState(value || "12:00 PM");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      setManualText(value);
      const p = parse12HourTime(value);
      if (p) {
        setSelectedHour(p.hour);
        setSelectedMinute(p.minute);
        setSelectedPeriod(p.period);
        setLocalError(null);
      }
    }
  }, [value]);

  const updateFromSelectors = (hr: string, min: string, pr: "AM" | "PM") => {
    const formatted = `${hr.padStart(2, "0")}:${min.padStart(2, "0")} ${pr}`;
    setSelectedHour(hr);
    setSelectedMinute(min);
    setSelectedPeriod(pr);
    setManualText(formatted);
    setLocalError(null);
    onChange(formatted);
  };

  const handleManualChange = (raw: string) => {
    setManualText(raw);
    if (!raw.trim()) {
      setLocalError("Time is required.");
      return;
    }

    if (validate12HourTime(raw)) {
      setLocalError(null);
      const p = parse12HourTime(raw);
      if (p) {
        setSelectedHour(p.hour);
        setSelectedMinute(p.minute);
        setSelectedPeriod(p.period);
        onChange(`${p.hour}:${p.minute} ${p.period}`);
      }
    } else {
      setLocalError("Invalid format. Expected format: HH:MM AM/PM (e.g. 02:05 PM)");
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Hour Select */}
        <select
          value={selectedHour}
          onChange={(e) => updateFromSelectors(e.target.value, selectedMinute, selectedPeriod)}
          className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-2.5 py-2 text-xs font-semibold text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span className="text-xs font-bold text-[#6B6B67]">:</span>

        {/* Minute Select */}
        <select
          value={selectedMinute}
          onChange={(e) => updateFromSelectors(selectedHour, e.target.value, selectedPeriod)}
          className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-2.5 py-2 text-xs font-semibold text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* AM/PM Toggle */}
        <div className="inline-flex rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-0.5">
          <button
            type="button"
            onClick={() => updateFromSelectors(selectedHour, selectedMinute, "AM")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
              selectedPeriod === "AM"
                ? "bg-[#7A1F2B] text-white shadow-2xs"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => updateFromSelectors(selectedHour, selectedMinute, "PM")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
              selectedPeriod === "PM"
                ? "bg-[#7A1F2B] text-white shadow-2xs"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            PM
          </button>
        </div>

        {/* Formatted Manual Text Display */}
        <input
          id={id}
          type="text"
          value={manualText}
          onChange={(e) => handleManualChange(e.target.value)}
          placeholder="02:05 PM"
          className="w-28 rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3 py-2 text-xs font-mono text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
        />
      </div>

      {(localError || error) && (
        <p className="text-[11px] font-medium text-[#C94A4A]">
          {localError || error}
        </p>
      )}
    </div>
  );
}
