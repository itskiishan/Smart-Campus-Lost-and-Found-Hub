"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        const { data: profile } = await (supabase.from("users") as any)
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.role && ["admin", "super_admin"].includes(profile.role)) {
          setIsAdmin(true);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { data: profile } = await (supabase.from("users") as any)
          .select("role")
          .eq("id", currentUser.id)
          .maybeSingle();
        setIsAdmin(profile?.role && ["admin", "super_admin"].includes(profile.role));
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    router.push("/login");
    router.refresh();
  };

  const fullName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";
  const admissionNumber = user?.user_metadata?.admission_number;
  const email = user?.email;
  const reportHref = user ? "/report" : "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E6E1] bg-[#FAFAF8]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left Side: Clean ABESEC Branding */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7A1F2B] text-white font-bold text-xs tracking-wider shadow-2xs transition duration-150 group-hover:bg-[#631822]">
            ABES
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-[#171717] sm:text-base">
              Lost &amp; Found
            </span>
            <span className="hidden text-[10px] text-[#6B6B67] sm:inline-block">
              ABES Engineering College, Ghaziabad
            </span>
          </div>
        </Link>

        {/* Right Side: Header Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            href={reportHref}
            className="inline-flex items-center justify-center rounded-lg bg-[#7A1F2B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition duration-150 hover:bg-[#631822] focus:outline-none focus:ring-2 focus:ring-[#7A1F2B]/20 active:scale-98"
          >
            + Report an item
          </Link>

          {!loading && (
            <>
              {user ? (
                /* Authenticated Student Dropdown */
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-lg border border-[#E8E6E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#171717] transition duration-150 hover:border-[#7A1F2B]/30 hover:bg-[#FAFAF8] focus:outline-none"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7A1F2B] text-[9px] font-bold text-white uppercase">
                      {fullName.charAt(0)}
                    </span>
                    <span className="max-w-[100px] truncate sm:max-w-[140px]">
                      {fullName}
                    </span>
                    {isAdmin && (
                      <span className="rounded bg-[#7A1F2B] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                        Admin
                      </span>
                    )}
                    <svg
                      className={`h-3.5 w-3.5 text-[#6B6B67] transition-transform duration-150 ${
                        dropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                      />
                    </svg>
                  </button>

                  {/* Refined Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-[#E8E6E1] bg-white p-1.5 shadow-sm animate-dropdown z-50 origin-top-right">
                      {/* Profile Card Header */}
                      <div className="rounded-lg bg-[#FAFAF8] p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#171717] truncate">
                            {fullName}
                          </p>
                          {isAdmin && (
                            <span className="rounded bg-[#7A1F2B] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                              Admin
                            </span>
                          )}
                        </div>
                        {admissionNumber && (
                          <p className="text-[10px] font-medium text-[#7A1F2B] mt-0.5">
                            Adm No: {admissionNumber}
                          </p>
                        )}
                        {email && (
                          <p className="text-[10px] text-[#6B6B67] truncate mt-0.5">
                            {email}
                          </p>
                        )}
                      </div>

                      {isAdmin && (
                        <>
                          <div className="my-1 border-t border-[#E8E6E1]" />
                          <Link
                            href="/admin"
                            onClick={() => setDropdownOpen(false)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#7A1F2B] transition duration-150 hover:bg-[#F6EDEF]"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />
                            </svg>
                            Admin Portal
                          </Link>
                        </>
                      )}

                      <div className="my-1 border-t border-[#E8E6E1]" />

                      {/* Logout Action */}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#C94A4A] transition duration-150 hover:bg-[#F6EDEF]/60"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                          />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Unauthenticated Login Link */
                <Link
                  href="/login"
                  className="rounded-lg border border-[#7A1F2B]/30 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#7A1F2B] transition duration-150 hover:bg-[#F6EDEF]"
                >
                  Login
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
