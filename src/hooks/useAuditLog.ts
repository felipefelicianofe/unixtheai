import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (action: string, details: Record<string, unknown> = {}) => {
      if (!user) return;
      try {
        // Use rpc or raw fetch since types may not be synced yet
        const { error } = await (supabase as unknown as { from: (t: string) => { insert: (r: Record<string, unknown>[]) => Promise<{ error: unknown }> } })
          .from("admin_audit_log")
          .insert([{ admin_id: user.id, action, details }]);
        if (error) console.error("[AuditLog] Error:", error);
      } catch (err) {
        console.error("[AuditLog] Failed to log action:", err);
      }
    },
    [user]
  );

  return { logAction };
}
