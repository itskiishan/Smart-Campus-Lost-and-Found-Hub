"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // 1. Email validation
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith("@abes.ac.in")) {
      setError("Only @abes.ac.in emails are allowed.");
      return;
    }

    if (isSignUp) {
      // 2. Full Name check
      if (!fullName.trim()) {
        setError("Full Name is required.");
        return;
      }

      // 3. Admission number validation
      const trimmedAdmission = admissionNumber.trim();
      if (!trimmedAdmission) {
        setError("Admission number is required.");
        return;
      }

      // 4. Password match check
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      setLoading(true);

      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              admission_number: trimmedAdmission,
            },
          },
        });

        if (signUpError) {
          const lowerMsg = signUpError.message.toLowerCase();
          if (
            lowerMsg.includes("admission_number") ||
            lowerMsg.includes("admission number") ||
            lowerMsg.includes("users_admission_number_key") ||
            lowerMsg.includes("unique")
          ) {
            setError("This admission number is already registered.");
          } else {
            setError(signUpError.message);
          }
        } else {
          if (data.session) {
            router.push("/");
            router.refresh();
          } else {
            setMessage(
              "Account created successfully! Please check your email to confirm your account."
            );
          }
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during signup."
        );
      } finally {
        setLoading(false);
      }
    } else {
      // Login
      setLoading(true);

      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          router.push("/");
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during login."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleMode = (signUp: boolean) => {
    setIsSignUp(signUp);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#FAFAF8] px-4 py-12 sm:px-6 lg:px-8 text-[#171717]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex flex-col items-center justify-center gap-2 group">
          <img
            src="/logo.png"
            alt="Zeteo Logo"
            className="h-10 w-10 object-contain shrink-0 transition duration-150 group-hover:scale-105"
          />
          <h2 className="text-center text-xl font-extrabold tracking-tight text-[#171717] sm:text-2xl">
            Zeteo
          </h2>
        </Link>
        <p className="mt-1 text-center text-xs text-[#6B6B67]">
          Campus Lost &amp; Found
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-6 shadow-2xs sm:p-8">
          {/* Mode Switcher Tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-[#FAFAF8] p-1 border border-[#E8E6E1]">
            <button
              type="button"
              onClick={() => toggleMode(false)}
              className={`rounded-lg py-2 text-xs font-bold transition ${
                !isSignUp
                  ? "bg-[#7A1F2B] text-white shadow-2xs"
                  : "text-[#6B6B67] hover:text-[#171717]"
              }`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => toggleMode(true)}
              className={`rounded-lg py-2 text-xs font-bold transition ${
                isSignUp
                  ? "bg-[#7A1F2B] text-white shadow-2xs"
                  : "text-[#6B6B67] hover:text-[#171717]"
              }`}
            >
              SIGN UP
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-[#C94A4A]">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-[#4F7C68]">
              {message}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kishan Kumar"
                    className="mt-1 block w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admissionNumber"
                    className="block text-xs font-semibold text-[#171717]"
                  >
                    Admission Number
                  </label>
                  <input
                    id="admissionNumber"
                    type="text"
                    required
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value)}
                    placeholder="e.g. 2024ZT1234"
                    className="mt-1 block w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                  />
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#171717]"
              >
                Campus Email (@abes.ac.in)
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@campus.edu"
                className="mt-1 block w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-[#171717]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
              />
            </div>

            {isSignUp && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-[#171717]"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2.5 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/15"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-[#7A1F2B] py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#631822] focus:outline-none disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : isSignUp
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
