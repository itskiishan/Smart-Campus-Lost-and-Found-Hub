"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdminUserDetail, UserRole } from "@/types/database";
import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ErrorState from "@/components/admin/ErrorState";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("admin");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Role Action Target
  const [roleTarget, setRoleTarget] = useState<{
    user: AdminUserDetail;
    newRole: UserRole;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current authenticated user session
      const { data: sessionData } = await supabase.auth.getUser();
      if (sessionData.user) {
        setCurrentUserId(sessionData.user.id);
        const { data: profile } = await (supabase.from("users") as any)
          .select("role")
          .eq("id", sessionData.user.id)
          .maybeSingle();

        if (profile?.role) {
          setCurrentUserRole(profile.role as UserRole);
        }
      }

      // Fetch users via RPC admin_get_users
      const { data, error: rpcErr } = await (supabase as any).rpc("admin_get_users", {
        p_role: roleFilter || null,
        p_search: search.trim() || null,
      });

      if (rpcErr) {
        console.error("admin_get_users error:", rpcErr);
        setError(`Failed to load users: ${rpcErr.message}`);
      } else if (data && Array.isArray(data)) {
        setUsers(data as AdminUserDetail[]);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Fetch users exception:", err);
      setError(err instanceof Error ? err.message : "Error loading users.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateRole = async (reason: string) => {
    if (!roleTarget) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const { error: rpcErr } = await (supabase as any).rpc("admin_update_user_role", {
        p_target_user_id: roleTarget.user.id,
        p_new_role: roleTarget.newRole,
        p_reason: reason || null,
      });

      if (rpcErr) {
        console.error("admin_update_user_role error:", rpcErr);
        setActionError(`Failed to update user role: ${rpcErr.message}`);
      } else {
        setRoleTarget(null);
        await fetchUsers();
      }
    } catch (err) {
      console.error("Update role exception:", err);
      setActionError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const isSuperAdmin = currentUserRole === "super_admin";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8E6E1] pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#171717] sm:text-2xl">
              Student Directory &amp; Role Management
            </h1>
            <p className="text-xs text-[#6B6B67] mt-0.5">
              Inspect student admission numbers, report activity, and manage administrative privileges.
            </p>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={fetchUsers} />}
        {actionError && <ErrorState title="Role Management Error" message={actionError} />}

        {/* Search & Filter Controls */}
        <div className="rounded-2xl border border-[#E8E6E1] bg-white p-4 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                placeholder="Search name, admission number, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2 text-xs text-[#171717] placeholder-[#6B6B67] focus:border-[#7A1F2B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-xl border border-[#E8E6E1] bg-[#FAFAF8] px-3.5 py-2 text-xs text-[#171717] focus:border-[#7A1F2B] focus:outline-none font-semibold text-[#7A1F2B]"
              >
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="admin">Administrators</option>
                <option value="super_admin">Super Administrators</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 w-full rounded-2xl border border-[#E8E6E1] bg-white animate-shimmer" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="No student or administrator profiles match your search criteria."
          />
        ) : (
          <div className="rounded-2xl border border-[#E8E6E1] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAFAF8] text-[10px] font-bold text-[#6B6B67] uppercase tracking-wider">
                    <th className="p-3.5 pl-4">Full Name</th>
                    <th className="p-3.5">Admission No</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5 text-center">Reports</th>
                    <th className="p-3.5 text-center">Claims</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E6E1]">
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;

                    return (
                      <tr key={u.id} className="hover:bg-[#FAFAF8]/80 transition">
                        <td className="p-3.5 pl-4 font-bold text-[#171717]">
                          {u.full_name}
                          {isSelf && (
                            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[#171717] font-semibold">
                          {u.admission_number}
                        </td>
                        <td className="p-3.5 text-[#6B6B67]">{u.email}</td>
                        <td className="p-3.5">
                          <StatusBadge status={u.role} type="role" />
                        </td>
                        <td className="p-3.5 text-center font-semibold text-[#171717]">
                          {u.reports_count}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-[#171717]">
                          {u.claims_count}
                        </td>
                        <td className="p-3.5 text-[#6B6B67]">
                          {new Date(u.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          {!isSelf && isSuperAdmin ? (
                            <div className="inline-flex items-center gap-1">
                              {u.role === "student" && (
                                <button
                                  onClick={() => setRoleTarget({ user: u, newRole: "admin" })}
                                  className="rounded-lg border border-[#7A1F2B]/30 bg-[#F6EDEF] px-2.5 py-1 text-[10px] font-bold text-[#7A1F2B] hover:bg-[#7A1F2B] hover:text-white transition"
                                >
                                  Make Admin
                                </button>
                              )}

                              {u.role === "admin" && (
                                <>
                                  <button
                                    onClick={() => setRoleTarget({ user: u, newRole: "super_admin" })}
                                    className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-800 hover:bg-purple-600 hover:text-white transition"
                                  >
                                    Grant Super
                                  </button>
                                  <button
                                    onClick={() => setRoleTarget({ user: u, newRole: "student" })}
                                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-100 transition"
                                  >
                                    Demote
                                  </button>
                                </>
                              )}

                              {u.role === "super_admin" && (
                                <button
                                  onClick={() => setRoleTarget({ user: u, newRole: "admin" })}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition"
                                >
                                  Demote to Admin
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#6B6B67] italic">
                              {isSelf
                                ? "Self Profile"
                                : u.role === "super_admin"
                                ? "Protected Super Admin"
                                : "Super Admin only"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Role Change Confirmation Dialog */}
        {roleTarget && (
          <ConfirmDialog
            isOpen={true}
            title={`Change User Role: ${roleTarget.user.full_name}`}
            description={`Are you sure you want to change ${roleTarget.user.full_name}'s role from ${roleTarget.user.role.toUpperCase()} to ${roleTarget.newRole.toUpperCase()}?`}
            warningText={
              roleTarget.newRole !== "student"
                ? "Granting administrative privileges permits access to the internal ABESEC Lost & Found Admin Portal."
                : "Demoting an administrator revokes their access to the Admin Portal."
            }
            requireReason={false}
            reasonPlaceholder="State the administrative reason for this role assignment..."
            confirmText={`Update Role to ${roleTarget.newRole.toUpperCase()}`}
            confirmButtonVariant="primary"
            isLoading={actionLoading}
            onClose={() => setRoleTarget(null)}
            onConfirm={handleUpdateRole}
          />
        )}
      </div>
    </AdminLayout>
  );
}
