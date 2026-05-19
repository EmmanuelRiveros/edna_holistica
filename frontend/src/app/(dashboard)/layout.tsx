"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Calendar,
  Clock,
  Users,
  Sparkles,
  CreditCard,
  LogOut,
  Menu,
  X,
  Package,
  Tag,
  ShoppingCart,
  Ticket,
  Settings,
  Star,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/agenda/disponibilidad", label: "Disponibilidad", icon: Clock },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/services", label: "Catálogo", icon: Sparkles },
  { href: "/payments", label: "Pagos", icon: CreditCard },
];

const tiendaItems = [
  { href: "/tienda", label: "Productos", icon: Package },
  { href: "/tienda/categorias", label: "Categorías", icon: Tag },
  { href: "/tienda/ordenes", label: "Órdenes", icon: ShoppingCart },
  { href: "/tienda/cupones", label: "Cupones", icon: Ticket },
  { href: "/tienda/resenas", label: "Reseñas", icon: Star },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerifying, setIsVerifying] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // ── Auth guard: verificar rol y token ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    // Sin token: redirigir a login
    if (!token) {
      router.replace("/login");
      return;
    }

    // Sin datos de usuario: redirigir a login
    if (!userStr) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);

      // Si es cliente: redirigir al portal
      if (user.role === "client") {
        router.replace("/portal");
        return;
      }

      // Solo admin y therapist pueden acceder
      if (user.role !== "admin" && user.role !== "therapist") {
        router.replace("/login");
        return;
      }

      setUserRole(user.role);
      setIsVerifying(false);
    } catch {
      // Si hay error al parsear: limpiar y redirigir
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/");
  };

  // No renderizar hasta que se verifique el token y rol
  if (isVerifying) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isAdmin = userRole === "admin";

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
            <Link href={isAdmin ? "/dashboard" : "/agenda"} className="block cursor-pointer">
              <h1 className="text-lg font-bold text-primary">Edna Lugo</h1>
              <p className="text-xs text-text-muted tracking-wide">Holística</p>
            </Link>
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
              // Filtrar items exclusivos de admin
              if ((href === "/dashboard" || href === "/payments") && !isAdmin) return null;

              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-colors duration-150
                    ${isActive
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

            {/* Separador + Tienda */}
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-border">
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Tienda
                </p>
                {tiendaItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                        transition-colors duration-150
                        ${isActive
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
              </div>
            )}
          </nav>

          {/* Configuración */}
          {isAdmin && (
            <div className="border-t border-border px-3 py-2 space-y-1">
              <Link
                href="/configuracion"
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                  transition-colors duration-150
                  ${pathname === "/configuracion"
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-background hover:text-text-primary"
                  }
                `}
              >
                <Settings size={18} />
                Configuración
              </Link>

            </div>
          )}

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
