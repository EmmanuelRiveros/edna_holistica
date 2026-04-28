"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { User, LogOut, Home, Calendar, CalendarPlus, Menu, X } from "lucide-react";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Protección de rutas
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
      router.push("/login");
    } else if (user.role !== "client") {
      router.push("/");
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const navLinks = [
    { name: "Inicio", path: "/portal", icon: Home },
    { name: "Mis Reservas", path: "/portal/reservas", icon: Calendar },
    { name: "Agendar Cita", path: "/portal/agendar", icon: CalendarPlus },
  ];

  if (!isAuthorized) {
    return null; // Prevents flashing content while redirecting
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Navbar ── */}
      <header className="bg-surface shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex shrink-0 items-center">
              <Link href="/portal" className="text-xl font-bold text-primary">
                Edna Holística
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`inline-flex items-center gap-1.5 px-1 pt-1 text-sm font-medium transition-colors border-b-2
                                ${
                                  isActive
                                    ? "border-primary text-primary"
                                    : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
                                }`}
                  >
                    <Icon size={16} />
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Logout Button */}
            <div className="hidden md:flex items-center">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-danger transition-colors p-2 rounded-md hover:bg-danger-light"
                title="Cerrar Sesión"
              >
                <LogOut size={18} />
                <span className="hidden lg:inline">Cerrar Sesión</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-surface border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    href={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors
                                ${
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-text-secondary hover:bg-background hover:text-text-primary"
                                }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      {link.name}
                    </div>
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-danger hover:bg-danger-light transition-colors mt-4"
              >
                <LogOut size={18} />
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
