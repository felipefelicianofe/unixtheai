import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  type: "TP1" | "TP2" | "TP3" | "LOSS" | "BREAKEVEN" | "NEW_SIGNAL" | "INFO";
  title: string;
  message: string;
  asset: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "katon-notifications";
const MAX_NOTIFICATIONS = 50;

function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch { /* ignore */ }
}

export function useNotifications() {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);
  const prevStatesRef = useRef<Map<string, string>>(new Map());

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
    const newNotif: AppNotification = {
      ...notif,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  // Listen to realtime changes on auto_management_history
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("management-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auto_management_history",
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          const oldRow = payload.old as Record<string, unknown>;
          const asset = (newRow.asset as string) || "?";
          const status = newRow.status as string;
          const oldStatus = oldRow.status as string;

          // Only notify on status transitions
          if (status === oldStatus) return;

          const typeMap: Record<string, AppNotification["type"]> = {
            WIN_TP1: "TP1",
            WIN_TP2: "TP2",
            WIN_TP3: "TP3",
            LOSS: "LOSS",
          };

          const type = typeMap[status];
          if (!type) return;

          const titleMap: Record<string, string> = {
            TP1: `🎯 TP1 atingido — ${asset}`,
            TP2: `🎯🎯 TP2 atingido — ${asset}`,
            TP3: `🎯🎯🎯 TP3 atingido — ${asset}`,
            LOSS: `❌ Stop Loss — ${asset}`,
          };

          const pnl = newRow.virtual_pnl_pct as number | null;
          const pnlStr = pnl ? ` | PnL: ${(pnl * 100).toFixed(2)}%` : "";

          addNotification({
            type,
            title: titleMap[type] || `${status} — ${asset}`,
            message: `Sinal encerrado como ${status}${pnlStr}`,
            asset,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, addNotification]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAllRead,
    clearAll,
  };
}
