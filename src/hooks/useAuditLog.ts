import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (action: string, details: Record<string, unknown> = {}) => {
      if (!user) return;
      try {
        await supabase.from("admin_audit_log" as "admin_audit_log" & keyof typeof supabase).insert({
          admin_id: user.id,
          action,
          details,
        } as Record<string, unknown>);
      } catch (err) {
        console.error("[AuditLog] Failed to log action:", err);
      }
    },
    [user]
  );

  return { logAction };
}
