import { Activity, BarChart3, Bot, Clock, LogOut, TestTube, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { BuildIndicator } from "@/components/layout/BuildIndicator";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "AutoTrade", href: "/autotrade", icon: Bot },
  { label: "Auto Teste", href: "/autoteste", icon: TestTube },
  { label: "Auto Gerenciamento", href: "/autogerenciamento", icon: Briefcase },
  { label: "Histórico", href: "/history", icon: Clock },
];

const AppNavBar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">Katon AI</span>
          </Link>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 overflow-x-auto max-w-[60vw] sm:max-w-none scrollbar-hide">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.href} to={item.href}>
                  <button
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-md"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <item.icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            <BuildIndicator />
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--neon-green))] animate-pulse" />
            <span className="text-xs text-muted-foreground hidden sm:block">Online</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground h-8 w-8"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default AppNavBar;
