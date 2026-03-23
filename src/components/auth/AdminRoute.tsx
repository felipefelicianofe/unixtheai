import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();

  // Se estiver carregando, mostramos um loader estável e NÃO redirecionamos.
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="ml-3 text-muted-foreground animate-pulse">Autenticando Katon AI...</span>
      </div>
    );
  }

  // Só redireciona para o login se o carregamento CONCLUIU e o usuário é de fato inexistente ou proibido.
  if (!user || !isAdmin) {
    console.warn("[AdminRoute] Acesso Negado/Inexistente. Movendo para Login.");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
