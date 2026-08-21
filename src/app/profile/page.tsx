"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { UserRow } from "@/types/database";
import Header from "@/components/Header";
import type { User } from "@supabase/supabase-js";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  admin: "Admin",
  super_admin: "Super Admin",
};

function DisplayField({
  label,
  value,
  note,
  isLocked,
}: {
  label: string;
  value: string | null | undefined;
  note?: string;
  isLocked?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6B67]">{label}</p>
        {isLocked && (
          <span className="text-[10px] text-[#6B6B67]" title="Protected field">
            <svg className="h-3 w-3 inline text-[#6B6B67]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-[#171717]">{value || <span className="italic text-[#6B6B67]">Not set</span>}</p>
      {note && <p className="mt-0.5 text-[10px] text-[#6B6B67]">{note}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // OTP Verification state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setAuthUser(user);

      const { data, error: profileErr } = await (supabase
        .from("users") as any)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        setError(profileErr.message);
      } else {
        const userRow = data as UserRow;
        setProfile(userRow);
        setEditFullName(userRow?.full_name ?? user.user_metadata?.full_name ?? "");
        setEditPhone(userRow?.phone ?? "");
      }
      setLoading(false);
    });
  }, [router]);

  const handleStartEdit = () => {
    setError(null);
    setSuccessMessage(null);
    setOtpSent(false);
    setOtp("");
    setEditFullName(profile?.full_name ?? authUser?.user_metadata?.full_name ?? "");
    setEditPhone(profile?.phone ?? "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setError(null);
    setSuccessMessage(null);
    setOtpSent(false);
    setOtp("");
    setIsEditing(false);
  };

  // Step 1: Send OTP to student registered college email using Supabase Auth
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const email = profile?.email ?? authUser?.email;
    if (!email) {
      setError("No registered college email found for this account.");
      return;
    }

    if (!editFullName.trim()) {
      setError("Full Name is required.");
      return;
    }

    setOtpSending(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpErr) {
        setError(`Failed to send verification code: ${otpErr.message}`);
      } else {
        setOtpSent(true);
        setSuccessMessage(`A 6-digit verification code was sent to ${email}. Please check your college inbox.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification email.");
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: Verify OTP and save profile changes
  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!authUser?.id) {
      setError("Authentication session not found. Please log in again.");
      return;
    }

    const email = profile?.email ?? authUser?.email;
    if (!email) {
      setError("No registered college email found for this account.");
      return;
    }

    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    if (!editFullName.trim()) {
      setError("Full Name cannot be empty.");
      return;
    }

    setVerifying(true);
    try {
      // 1. Verify OTP with Supabase Auth
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: trimmedOtp,
        type: "email",
      });

      if (verifyErr) {
        setError(`Verification failed: ${verifyErr.message}`);
        setVerifying(false);
        return;
      }

      // Security hardening: explicitly verify that OTP user ID matches the authenticated session user ID
      if (!verifyData.user || verifyData.user.id !== authUser.id) {
        setError("Security verification failed: Verification identity mismatch.");
        setVerifying(false);
        return;
      }

      const cleanedName = editFullName.trim();
      const cleanedPhone = editPhone.trim() || null;

      // 2. Update public.users record using strictly authUser.id
      const { error: updateErr } = await (supabase.from("users") as any)
        .update({
          full_name: cleanedName,
          phone: cleanedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.id);

      if (updateErr) {
        setError(`Failed to update profile record: ${updateErr.message}`);
        setVerifying(false);
        return;
      }

      // 3. Update Supabase Auth user_metadata
      await supabase.auth.updateUser({
        data: { full_name: cleanedName },
      });

      // 4. Update local state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: cleanedName,
              phone: cleanedPhone,
              updated_at: new Date().toISOString(),
            }
          : null
      );

      setSuccessMessage("Profile verified and updated successfully!");
      setIsEditing(false);
      setOtpSent(false);
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#171717]">My Profile</h1>
            <p className="mt-0.5 text-xs text-[#6B6B67]">
              {isEditing
                ? "Update your personal details. Verification via college email is required."
                : "Your account information registered with the campus hub."}
            </p>
          </div>
          {!loading && !isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Edit Profile
            </button>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] transition hover:bg-[#FAFAF8]"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Status messages */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-[#C94A4A]">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-[#4F7C68]">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[#E8E6E1] bg-white p-6 space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 w-20 rounded animate-shimmer" />
                <div className="h-4 w-48 rounded animate-shimmer" />
              </div>
            ))}
          </div>
        ) : isEditing ? (
          /* Edit Mode Form */
          <div className="rounded-xl border border-[#E8E6E1] bg-white p-5 sm:p-6 space-y-5">
            <div className="border-b border-[#E8E6E1] pb-4">
              <h2 className="text-sm font-bold text-[#171717]">Edit Personal Information</h2>
              <p className="mt-0.5 text-xs text-[#6B6B67]">
                Institutional fields such as your admission number and role cannot be altered directly.
              </p>
            </div>

            <form onSubmit={otpSent ? handleVerifyAndSave : handleSendOtp} className="space-y-4">
              {/* Full Name (Editable) */}
              <div>
                <label htmlFor="editFullName" className="block text-xs font-semibold text-[#171717] mb-1">
                  Full Name <span className="text-[#C94A4A]">*</span>
                </label>
                <input
                  id="editFullName"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Phone (Editable) */}
              <div>
                <label htmlFor="editPhone" className="block text-xs font-semibold text-[#171717] mb-1">
                  Phone Number <span className="text-[10px] font-normal text-[#6B6B67]">(Optional)</span>
                </label>
                <input
                  id="editPhone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-2.5 text-xs text-[#171717] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Read-only Institutional Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E6E1]">
                <DisplayField
                  label="Admission Number"
                  value={profile?.admission_number}
                  note="Institutional identifier - cannot be changed."
                  isLocked
                />
                <DisplayField
                  label="Registered Email"
                  value={profile?.email ?? authUser?.email}
                  note="Verification OTP will be sent here."
                  isLocked
                />
                <DisplayField
                  label="Role"
                  value={ROLE_LABELS[profile?.role ?? "student"] ?? profile?.role}
                  note="Managed by administrators."
                  isLocked
                />
              </div>

              {/* Email OTP Verification Section */}
              <div className="pt-3 border-t border-[#E8E6E1] space-y-3">
                <div className="rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#171717]">
                    <svg className="h-4 w-4 text-[#7A1F2B]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    College Email Verification Required
                  </div>
                  <p className="text-[11px] text-[#6B6B67] leading-relaxed">
                    To prevent unauthorized modifications, changes must be verified through your registered college email (
                    <span className="font-semibold text-[#171717]">{profile?.email ?? authUser?.email}</span>).
                  </p>

                  {otpSent && (
                    <div className="pt-2 space-y-2">
                      <label htmlFor="otpInput" className="block text-xs font-semibold text-[#171717]">
                        Enter 6-Digit Email Verification Code <span className="text-[#C94A4A]">*</span>
                      </label>
                      <input
                        id="otpInput"
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="w-48 tracking-widest text-center text-sm font-bold rounded-xl border border-[#E8E6E1] bg-white p-2.5 text-[#171717] focus:border-[#7A1F2B] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 pt-2">
                  {!otpSent ? (
                    <button
                      type="submit"
                      disabled={otpSending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822] disabled:opacity-50"
                    >
                      {otpSending ? "Sending Code..." : "Send Verification Code"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="submit"
                        disabled={verifying || otp.trim().length !== 6}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822] disabled:opacity-50"
                      >
                        {verifying ? "Verifying & Saving..." : "Verify & Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpSending}
                        className="rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-xs font-medium text-[#171717] transition hover:bg-[#FAFAF8] disabled:opacity-50"
                      >
                        {otpSending ? "Resending..." : "Resend Code"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-[#6B6B67] hover:text-[#171717]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* Normal Display View */
          <div className="rounded-xl border border-[#E8E6E1] bg-white divide-y divide-[#E8E6E1]">
            {/* Avatar + name header */}
            <div className="flex items-center gap-3.5 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7A1F2B] text-base font-bold text-white uppercase">
                {(profile?.full_name ?? authUser?.email ?? "?").charAt(0)}
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#171717]">
                  {profile?.full_name ?? authUser?.user_metadata?.full_name ?? "Student"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B6B67]">
                  {ROLE_LABELS[profile?.role ?? "student"] ?? profile?.role}
                </p>
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5">
              <DisplayField
                label="Full Name"
                value={profile?.full_name}
              />
              <DisplayField
                label="Admission Number"
                value={profile?.admission_number}
                note="Institutional identifier - cannot be changed."
                isLocked
              />
              <DisplayField
                label="Email Address"
                value={profile?.email ?? authUser?.email}
                note="Registered college email."
                isLocked
              />
              <DisplayField
                label="Phone"
                value={profile?.phone}
              />
              <DisplayField
                label="Role"
                value={ROLE_LABELS[profile?.role ?? "student"] ?? profile?.role}
                note="Managed by administrators."
                isLocked
              />
              <DisplayField
                label="Member Since"
                value={
                  profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : null
                }
              />
            </div>

            {/* Footer note */}
            <div className="px-5 py-3 text-[10px] text-[#6B6B67]">
              Profile last updated:{" "}
              {profile?.updated_at
                ? new Date(profile.updated_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Just now"}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}