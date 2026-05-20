import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  GitBranch,
  BookOpen,
  MessageSquare,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { tenant } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/BrandLogo";

const SIDEBAR_KEY = "sidebar-collapsed";

const nav = [
  { to: "/flows", label: "Flujos", icon: GitBranch },
  { to: "/kb", label: "Base de conocimiento", icon: BookOpen },
  { to: "/conversations", label: "Conversaciones", icon: MessageSquare },
  { to: "/settings", label: "Ajustes", icon: Settings },
] as const;

const pageTitles: Record<string, string> = {
  "/flows": "Flujos",
  "/kb": "Base de conocimiento",
  "/conversations": "Conversaciones",
  "/settings": "Ajustes",
};

export function Shell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: tenantData } = useQuery({
    queryKey: ["tenant"],
    queryFn: tenant.get,
  });

  const connected = Boolean(tenantData?.phone_number_id);
  const pageTitle = pageTitles[pathname] ?? "Panel";

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  const sidebarContent = (
    <>
      <div
        className={cn(
          "h-14 flex items-center border-b shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-3",
        )}
      >
        {!collapsed && <BrandLogo size="sm" />}
        {collapsed && <img src="/logo.svg" alt="WA AI SaaS" className="h-8 w-8 rounded-lg" />}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex h-8 w-8 shrink-0"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={cn("p-2 border-t space-y-2 shrink-0", collapsed && "flex flex-col items-center")}>
        {!collapsed && tenantData && (
          <div className="px-2 py-2 rounded-md bg-muted/50 space-y-1.5">
            <p className="text-xs font-medium truncate" title={tenantData.name}>
              {tenantData.name}
            </p>
            <Badge variant={connected ? "success" : "warning"} className="text-[10px]">
              {connected ? "WhatsApp conectado" : "Sin conectar"}
            </Badge>
          </div>
        )}
        {collapsed && tenantData && (
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              connected ? "bg-green-500" : "bg-amber-400",
            )}
            title={connected ? "WhatsApp conectado" : "Sin conectar"}
          />
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(!collapsed && "w-full justify-start gap-2")}
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Cerrar sesión"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-card transition-[width] duration-200",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r bg-card shadow-xl">
            <div className="h-14 flex items-center justify-between px-3 border-b">
              <BrandLogo size="sm" />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 p-2 space-y-1">
              {nav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
            {tenantData && (
              <div className="px-4 py-3 border-t space-y-2">
                <p className="text-sm font-medium truncate">{tenantData.name}</p>
                <Badge variant={connected ? "success" : "warning"}>
                  {connected ? "WhatsApp conectado" : "Sin conectar"}
                </Badge>
                <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="h-14 flex items-center gap-3 border-b px-4 md:px-6 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
