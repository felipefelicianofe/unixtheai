import { useState, useRef, useEffect } from "react";
import { Bell, Check, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppNotification } from "@/hooks/useNotifications";

interface NotificationBellProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const typeColors: Record<string, string> = {
  TP1: "bg-[hsl(var(--neon-green))]/20 text-[hsl(var(--neon-green))]",
  TP2: "bg-[hsl(var(--neon-green))]/30 text-[hsl(var(--neon-green))]",
  TP3: "bg-[hsl(var(--neon-green))]/40 text-[hsl(var(--neon-green))]",
  LOSS: "bg-[hsl(var(--neon-red))]/20 text-[hsl(var(--neon-red))]",
  BREAKEVEN: "bg-muted text-muted-foreground",
  NEW_SIGNAL: "bg-primary/20 text-primary",
  INFO: "bg-muted text-muted-foreground",
};

const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  onMarkAllRead,
  onClearAll,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) onMarkAllRead();
        }}
        className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--neon-red))] text-[9px] font-bold text-white flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 w-80 glass-strong rounded-xl border border-border/40 shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <span className="text-sm font-semibold text-foreground">Notificações</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClearAll}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 text-xs transition-colors ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="secondary"
                              className={`text-[9px] px-1.5 py-0 ${typeColors[n.type] || ""}`}
                            >
                              {n.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {timeAgo(n.timestamp)}
                            </span>
                          </div>
                          <p className="font-medium text-foreground truncate">{n.title}</p>
                          <p className="text-muted-foreground mt-0.5">{n.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
