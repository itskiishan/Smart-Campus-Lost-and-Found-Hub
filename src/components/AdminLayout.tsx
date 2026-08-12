"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminSidebar from "./admin/AdminSidebar";
import AdminHeader from "./admin/AdminHeader";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const SECTION_TITLES: Record<string, string> = {
  "/admin": "Campus Operations Overview",
  "/admin/reports": "Report Moderation & Management",
  "/admin/claims": "Claims Oversight & Dispute Resolution",
  "/admin/handovers": "Physical Handover Oversight",
  "/admin/custody": "Security Vault Physical Custody",
  "/admin/users": "Student Directory & Role Management",
  "/admin/locations": "Campus Locations Management",
  "/admin/audit-logs": "Administrative Audit Logs",
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminName, setAdminName] = useState("Administrator");
  const [adminRole, setAdminRole] = useState("admin");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Administrator";
        setAdminName(name);

        const { data: profile } = await (supabase.from("users") as any)
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role) {
          setAdminRole(profile.role);
        }
      }
    });
  }, []);

  const sectionTitle = SECTION_TITLES[pathname] || "Admin Portal";

  return (
    <div className="flex min-h-screen bg-[#FAFAF8] text-[#171717]">
      <AdminSidebar
        adminName={adminName}
        adminRole={adminRole}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <AdminHeader
          sectionTitle={sectionTitle}
          onMobileMenuToggle={() => setMobileOpen((prev) => !prev)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
