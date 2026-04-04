import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import AppNavBar from "@/components/AppNavBar";
import AdminCommandCenter from "@/components/admin/AdminCommandCenter";

export default function AdminPanel() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[200px]" />
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[180px]" />
      </div>

      <AppNavBar />

      <main className="relative z-10 pt-20 pb-20 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Command Center
              </h1>
              <p className="text-xs text-muted-foreground">
                Painel consolidado de controle administrativo
              </p>
            </div>
          </motion.div>

          <AdminCommandCenter />
        </div>
      </main>
    </div>
  );
}
