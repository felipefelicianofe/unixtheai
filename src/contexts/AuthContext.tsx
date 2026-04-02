import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const checkAdmin = async (userId: string) => {
    try {
      console.log(`[AuthContext] Checking admin for ${userId}...`);

      const { data, error: rpcError } = await supabase.rpc("has_role", {
        _role: "admin",
        _user_id: userId,
      });

      if (!mountedRef.current) return;

      if (!rpcError) {
        console.log(`[AuthContext] has_role RPC result: ${data}`);
        setIsAdmin(data === true);
        return;
      }

      console.warn("[AuthContext] has_role RPC failed, trying fallback...", rpcError);

      const { data: roleData, error: tableError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!mountedRef.current) return;

      if (tableError) {
        console.error("[AuthContext] Direct query fallback also failed:", tableError);
        setIsAdmin(false);
      } else {
        console.log("[AuthContext] Direct query result:", roleData);
        setIsAdmin(!!roleData);
      }
    } catch (err) {
      console.error("[AuthContext] Unexpected error in checkAdmin:", err);
      if (mountedRef.current) setIsAdmin(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    // 1. Restore session from storage FIRST — this prevents race conditions
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await checkAdmin(currentUser.id);
      }

      if (mountedRef.current) {
        setLoading(false);
        console.log("[AuthContext] Initial session restored, loading=false");
      }
    });

    // 2. Listen for SUBSEQUENT auth changes (sign-in, sign-out, token refresh)
    //    Do NOT await async calls here — fire and forget to avoid deadlocks
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      console.log(`[AuthContext] Auth event: ${event}`);

      // Skip INITIAL_SESSION — already handled by getSession above
      if (event === "INITIAL_SESSION") return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setLoading(true);
        // Fire-and-forget — no await inside onAuthStateChange
        checkAdmin(currentUser.id).finally(() => {
          if (mountedRef.current) setLoading(false);
        });
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
