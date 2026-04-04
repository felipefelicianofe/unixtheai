import { Activity, BarChart3, Bot, Clock, LogOut, TestTube, Briefcase, Radio, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationBell from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "Live Trade", href: "/livetrade", icon: Radio },
  { label: "AutoTrade", href: "/autotrade", icon: Bot },
  { label: "Auto Teste", href: "/autoteste", icon: TestTube },
  { label: "Auto Gerenciamento", href: "/autogerenciamento", icon: Briefcase },
  { label: "Histórico", href: "/history", icon: Clock },
  { label: "Admin", href: "/admin", icon: Shield },
];

const AppNavBar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

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
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onClearAll={clearAll}
            />
            {/* Theme toggle */}
            <button
              onClick={() => {
                const root = document.documentElement;
                const isDark = root.classList.contains("dark");
                if (isDark) {
                  root.classList.remove("dark");
                  localStorage.setItem("theme", "light");
                } else {
                  root.classList.add("dark");
                  localStorage.setItem("theme", "dark");
                }
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title="Alternar tema"
            >
              <svg className="w-4 h-4 dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <svg className="w-4 h-4 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
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
