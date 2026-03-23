import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    // Só prosseguimos se o carregamento do AuthContext terminou E o usuário existe
    if (!authLoading && user) {
      if (isAdmin) {
        console.log("[Login] Admin confirmado, navegando para o dashboard...");
        navigate("/autogerenciamento", { replace: true });
      } else {
        // PERMISSÃO NEGADA - Mas NÃO deslogamos o usuário à força
        // Isso evita o Loop de Login se houver um erro de rede ou disputa de trava (Mutex)
        console.warn("[Login] Usuário autenticado mas sem privilégios de admin confirmados. Mantendo sessão ativa para nova verificação automática.");
        
        toast({
          title: "Acesso Restrito",
          description: "Sua conta ainda não foi confirmada como Administrador. Verificando novamente em instantes...",
          variant: "destructive",
        });
      }
    }
  }, [user, isAdmin, authLoading, navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Wait a moment for auth state to propagate
      setTimeout(() => {
        setLoading(false);
      }, 1500);
    } catch (networkError) {
      console.error('[Login] Erro de rede (Failed to Fetch):', networkError);
      toast({
        title: "Erro de Conexão",
        description: "Falha ao conectar com o Supabase. Verifique sua conexão ou a configuração de ambiente (Vercel).",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-accent/8 rounded-full blur-[180px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Katon AI</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h1>
          <p className="text-sm text-muted-foreground">Área exclusiva para administradores</p>
        </div>

        <div className="glass rounded-2xl p-8 neon-border">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@katon.ai"
                className="bg-background/50 border-border/50 h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background/50 border-border/50 h-11"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground neon-glow h-11"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Acesso restrito a administradores autorizados.
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
