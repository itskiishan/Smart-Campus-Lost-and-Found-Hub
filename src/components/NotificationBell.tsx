"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { NotificationRow, NotificationType } from "@/types/database";

interface NotificationBellProps {
  userId: string;
}

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
    });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "NEW_CLAIM":
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200/60">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      );
    case "CLAIM_APPROVED":
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#4F7C68] border border-emerald-200/60">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case "CLAIM_REJECTED":
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#C94A4A] border border-red-200/60">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case "HANDOVER_STARTED":
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7A1F2B]/10 text-[#7A1F2B] border border-[#7A1F2B]/20">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
      );
    case "HANDOVER_COMPLETED":
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#4F7C68] border border-emerald-200/60">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-7.5 4.5l2.25 2.25L19.5 7.5" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#171717]">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
      );
  }
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch recent notifications & unread count
  const loadNotifications = async () => {
    if (!userId) return;

    try {
      // 1. Fetch unread count
      const { count } = await (supabase.from("notifications") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      setUnreadCount(count || 0);

      // 2. Fetch latest 8 notifications
      const { data, error } = await (supabase.from("notifications") as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn("Notifications fetch notice:", err);
    }
  };

  useEffect(() => {
    if (!userId) return;

    loadNotifications();

    // Set up Realtime listener for this user's notifications (.on must precede .subscribe)
    const channelTopic = `realtime-notifications-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Click outside and escape listeners
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleNotificationClick = async (notif: NotificationRow) => {
    // Mark as read if currently unread
    if (!notif.is_read) {
      try {
        await (supabase.from("notifications") as any)
          .update({ is_read: true })
          .eq("id", notif.id);

        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.warn("Failed to mark notification as read:", err);
      }
    }

    setIsOpen(false);

    // Navigate to target item/report
    if (notif.item_id) {
      router.push(`/item/${notif.item_id}`);
    } else {
      router.push("/notifications");
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);

    try {
      await (supabase.from("notifications") as any)
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E6E1] bg-white text-[#171717] transition duration-150 hover:border-[#7A1F2B]/30 hover:bg-[#FAFAF8] focus:outline-none"
      >
        <svg
          className="h-4 w-4 text-[#171717]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7A1F2B] px-1 text-[9px] font-bold text-white shadow-2xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-80 sm:w-96 rounded-xl border border-[#E8E6E1] bg-white shadow-md animate-dropdown z-50 origin-top-right overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E8E6E1] bg-[#FAFAF8] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#171717]">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#7A1F2B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#7A1F2B]">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="text-[11px] font-semibold text-[#7A1F2B] hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E8E6E1]/60">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full flex items-start gap-3 p-3 text-left transition duration-150 hover:bg-[#FAFAF8] ${
                    !notif.is_read ? "bg-[#7A1F2B]/[0.03]" : ""
                  }`}
                >
                  {/* Icon */}
                  {getNotificationIcon(notif.type)}

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p
                        className={`text-xs truncate ${
                          !notif.is_read ? "font-bold text-[#171717]" : "font-medium text-[#171717]"
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-[#6B6B67]">
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#6B6B67] line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>

                  {/* Unread indicator dot */}
                  {!notif.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#7A1F2B]" />
                  )}
                </button>
              ))
            ) : (
              <div className="py-10 px-4 text-center">
                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFAF8] text-[#6B6B67]">
                  <svg className="h-5 w-5 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-[#171717]">No notifications yet</p>
                <p className="text-[10px] text-[#6B6B67] mt-0.5">
                  Updates on your claims and handovers will appear here.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#E8E6E1] bg-[#FAFAF8] p-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-block text-xs font-bold text-[#7A1F2B] hover:underline py-1"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
