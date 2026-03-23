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
      console.log(`[AuthContext] Verificando Admin para ${userId} via is_admin_v3...`);
      
      const { data, error: rpcError } = await supabase.rpc("is_admin_v3", {
        _user_id: userId
      });
      
      if (!rpcError) {
        console.log(`[AuthContext] Resultado is_admin_v3 check: ${data}`);
        setIsAdmin(data === true);
        return;
      }

      // TRATAMENTO DE CONFLITO E LOCK: Se for erro de timeout ou conexão, NÃO deslogar precipitadamente
      const isLockError = rpcError.message?.includes("Lock") || rpcError.message?.includes("Abort");
      if (isLockError) {
        console.warn("[AuthContext] Detectado erro de Lock/Contenção de Mutex no navegador. Retendo estado atual para evitar loop.");
        // Não alteramos isAdmin nem deslogamos; deixamos a próxima verificação ou persistência cuidar disso.
        return;
      }

      console.warn("[AuthContext] is_admin_v3 falhou, tentando consulta direta...", rpcError);

      const { data: roleData, error: tableError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (tableError) {
        console.error("[AuthContext] Falha total na verificação de admin:", tableError);
        // Em caso de erro de conexão, preferimos assumir false por segurança, 
        // mas aqui mantemos o isAdmin anterior para evitar loop se for intermitente.
      } else {
        console.log("[AuthContext] Resultado Consulta Direta (Fallback):", roleData);
        setIsAdmin(!!roleData);
      }
    } catch (err) {
      console.error("[AuthContext] Erro fatal em checkAdmin:", err);
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
