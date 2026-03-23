import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  const checkAdmin = async (userId: string) => {
    try {
      console.log(`[AuthContext] Checking admin for ${userId}...`);
      
      // 1. Primary check via RPC (security definer bypasses RLS)
      const { data, error: rpcError } = await supabase.rpc("has_role", {
        _role: "admin",
        _user_id: userId
      });
      
      if (!rpcError) {
        console.log(`[AuthContext] has_role RPC result: ${data}`);
        setIsAdmin(data === true);
        setLoading(false);
        return;
      }

      console.warn("[AuthContext] has_role RPC failed, trying fallback direct query...", rpcError);

      // 2. Fallback check via direct table query (if RPC is missing or failing)
      // This works if the user has SELECT permission on their own role in user_roles
      const { data: roleData, error: tableError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (tableError) {
        console.error("[AuthContext] Direct query fallback also failed:", tableError);
        setIsAdmin(false);
      } else {
        console.log("[AuthContext] Direct query result:", roleData);
        setIsAdmin(!!roleData);
      }
    } catch (err) {
      console.error("[AuthContext] Unexpected error in checkAdmin:", err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Unify handling using onAuthStateChange which provides the initial session too
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthContext] Auth event: ${event}`);
      
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        setLoading(true);
        // We call checkAdmin directly but safely
        await checkAdmin(currentUser.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
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
