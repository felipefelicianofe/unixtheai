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
      console.log(`[AuthContext] Iniciando verificação de Admin para: ${userId}`);
      
      // 1. Primary check via RPC (security definer bypasses RLS)
      const { data, error: rpcError } = await supabase.rpc("has_role", {
        _role: "admin",
        _user_id: userId
      });
      
      if (!rpcError) {
        console.log(`[AuthContext] Resultado RPC has_role: ${data}`);
        setIsAdmin(data === true);
        return;
      }

      console.warn("[AuthContext] RPC falhou, tentando consulta direta à tabela user_roles...", rpcError);

      // 2. Fallback check via direct table query
      const { data: roleData, error: tableError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (tableError) {
        console.error("[AuthContext] Falha crítica em ambas verificações de admin:", tableError);
        setIsAdmin(false);
      } else {
        console.log("[AuthContext] Resultado Consulta Direta:", roleData);
        setIsAdmin(!!roleData);
      }
    } catch (err) {
      console.error("[AuthContext] Erro inesperado em checkAdmin:", err);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Assumimos loading inicial true. 
    // onAuthStateChange disparará IMEDIATAMENTE após subscrição se houver sessão.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthContext] Evento de Autenticação: ${event}`);
      
      if (!mounted) return;

      const currentUser = session?.user ?? null;

      // CRITICAL LOGIC: Se detectarmos transição de login/re-auth, seguramos o loading
      if (currentUser) {
        setLoading(true); // Garante que o loading trave antes do usuário ser injetado no UI
        
        // Primeiro verificamos autoridade
        await checkAdmin(currentUser.id);
        
        // Depois liberamos o usuário para o sistema já com isAdmin verificado
        setUser(currentUser);
        setLoading(false);
      } else {
        setUser(null);
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
