"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { NotificationRow, NotificationType } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import Header from "@/components/Header";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getNotificationBadge(type: NotificationType) {
  switch (type) {
    case "NEW_CLAIM":
      return {
        label: "New Claim",
        badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ),
      };
    case "CLAIM_APPROVED":
      return {
        label: "Claim Approved",
        badgeStyle: "bg-emerald-50 text-[#4F7C68] border-emerald-200",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    case "CLAIM_REJECTED":
      return {
        label: "Claim Rejected",
        badgeStyle: "bg-red-50 text-[#C94A4A] border-red-200",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    case "HANDOVER_STARTED":
      return {
        label: "Handover Started",
        badgeStyle: "bg-[#7A1F2B]/10 text-[#7A1F2B] border-[#7A1F2B]/20",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        ),
      };
    case "HANDOVER_COMPLETED":
      return {
        label: "Handover Completed",
        badgeStyle: "bg-emerald-50 text-[#4F7C68] border-emerald-200",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-7.5 4.5l2.25 2.25L19.5 7.5" />
          </svg>
        ),
      };
    default:
      return {
        label: "Update",
        badgeStyle: "bg-slate-100 text-[#171717] border-[#E8E6E1]",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        ),
      };
  }
}

export default function NotificationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);
  const router = useRouter();

  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await (supabase.from("notifications") as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn("Notifications page fetch notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;

    fetchNotifications(user.id);

    // Realtime subscription: .on("postgres_changes") MUST come before .subscribe()
    const channelTopic = `notifications-page-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await (supabase.from("notifications") as any)
        .update({ is_read: true })
        .eq("id", id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.warn("Failed to mark as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || markingAll) return;
    setMarkingAll(true);

    try {
      await (supabase.from("notifications") as any)
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.warn("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    activeTab === "all" ? true : !n.is_read
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#171717] sm:text-2xl">
              Notifications
            </h1>
            <p className="mt-1 text-xs text-[#6B6B67]">
              Track claim updates, approvals, and handover events across all your reports.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#7A1F2B] shadow-2xs transition hover:border-[#7A1F2B]/30 hover:bg-[#FAFAF8] disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-[#E8E6E1] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition duration-150 ${
              activeTab === "all"
                ? "bg-[#7A1F2B] text-white shadow-2xs"
                : "bg-white text-[#6B6B67] border border-[#E8E6E1] hover:text-[#171717]"
            }`}
          >
            All Notifications ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition duration-150 ${
              activeTab === "unread"
                ? "bg-[#7A1F2B] text-white shadow-2xs"
                : "bg-white text-[#6B6B67] border border-[#E8E6E1] hover:text-[#171717]"
            }`}
          >
            Unread Only ({unreadCount})
          </button>
        </div>

        {/* Notifications Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 w-full animate-pulse rounded-xl border border-[#E8E6E1] bg-white"
              />
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const badge = getNotificationBadge(notif.type);
              return (
                <div
                  key={notif.id}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition duration-150 hover:shadow-xs ${
                    !notif.is_read
                      ? "border-[#7A1F2B]/30 bg-white ring-1 ring-[#7A1F2B]/10"
                      : "border-[#E8E6E1] bg-white hover:border-[#7A1F2B]/20"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Badge Icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${badge.badgeStyle}`}
                    >
                      {badge.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.badgeStyle}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-[#6B6B67]">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                        {!notif.is_read && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#7A1F2B]/10 px-2 py-0.5 text-[9px] font-bold text-[#7A1F2B]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#7A1F2B]" />
                            Unread
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-[#171717]">{notif.title}</h3>
                      <p className="mt-0.5 text-xs text-[#6B6B67] leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!notif.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="rounded-lg border border-[#E8E6E1] bg-[#FAFAF8] px-2.5 py-1 text-[11px] font-medium text-[#6B6B67] transition hover:bg-white hover:text-[#171717]"
                      >
                        Mark read
                      </button>
                    )}

                    {notif.item_id && (
                      <Link
                        href={`/item/${notif.item_id}`}
                        onClick={() => {
                          if (!notif.is_read) handleMarkAsRead(notif.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#7A1F2B] px-3 py-1 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#631822]"
                      >
                        <span>View Report</span>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E8E6E1] bg-white p-12 text-center shadow-2xs">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FAFAF8] text-[#6B6B67]">
              <svg className="h-6 w-6 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-[#171717]">
              {activeTab === "all" ? "No notifications yet" : "No unread notifications"}
            </h3>
            <p className="mt-1 text-xs text-[#6B6B67] max-w-sm mx-auto">
              {activeTab === "all"
                ? "When someone submits a claim or starts a handover for your items, you will see notifications here."
                : "You're all caught up! No unread notifications to review."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
