"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Calendar,
  Users,
  Sparkles,
  CreditCard,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/",         label: "Dashboard", icon: Home },
  { href: "/agenda",   label: "Agenda",    icon: Calendar },
  { href: "/clients",  label: "Clientes",  icon: Users },
  { href: "/services", label: "Catálogo",  icon: Sparkles },
  { href: "/payments", label: "Pagos",     icon: CreditCard },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Auth guard: redirigir a /login si no hay token ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
    } else {
      setIsReady(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/login");
  };

  // No renderizar hasta que se verifique el token
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Overlay móvil ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform bg-surface shadow-lg
          transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <div>
              <h1 className="text-lg font-bold text-primary">Edna Lugo</h1>
              <p className="text-xs text-text-muted tracking-wide">Holística</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-text-secondary hover:text-text-primary"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navegación */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-colors duration-150
                    ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-text-secondary hover:bg-background hover:text-text-primary"
                    }
                  `}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Cerrar sesión */}
          <div className="border-t border-border px-3 py-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                         text-text-secondary hover:bg-danger-light hover:text-danger transition-colors duration-150"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header móvil */}
        <header className="flex items-center justify-between bg-surface px-4 py-3 shadow-sm lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-secondary hover:text-text-primary"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-sm font-bold text-primary">Edna Lugo Holística</h1>
          <div className="w-6" /> {/* Spacer */}
        </header>

        {/* Área de contenido */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
