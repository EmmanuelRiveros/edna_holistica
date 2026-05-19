"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Calendar, CalendarPlus, Activity, ShoppingBag } from "lucide-react";

export default function PortalDashboardPage() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserName(user.first_name || "Cliente");
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ── Header Section ── */}
      <section className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-10 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Bienvenido(a), {userName}
            </h1>
            <p className="text-white max-w-lg text-lg font-medium opacity-90">
              Tu espacio personal para gestionar reservas, consultar tu historial y administrar tu camino hacia la sanación.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/portal/agendar"
              className="inline-flex items-center gap-2 bg-white text-primary hover:bg-surface px-6 py-3 rounded-xl font-semibold transition-all shadow-sm hover:shadow active:scale-95"
            >
              <CalendarPlus size={20} />
              Agendar Nueva Cita
            </Link>
          </div>
        </div>
      </section>

      {/* ── Quick Actions / Stats ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Card 1: Próximas Citas */}
        <Link href="/portal/reservas" className="group">
          <div className="bg-surface rounded-xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all h-full flex flex-col items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Calendar size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text-primary mb-1 group-hover:text-primary transition-colors">
                Mis Reservas
              </h3>
              <p className="text-sm text-text-secondary">
                Revisa tus próximas citas programadas y tu historial de asistencias.
              </p>
            </div>
          </div>
        </Link>

        {/* Card 2: Agendar nueva */}
        <Link href="/portal/agendar" className="group">
          <div className="bg-surface rounded-xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all h-full flex flex-col items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 group-hover:scale-110 transition-transform">
              <CalendarPlus size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text-primary mb-1 group-hover:text-emerald-600 transition-colors">
                Agendar Cita
              </h3>
              <p className="text-sm text-text-secondary">
                Explora nuestros servicios y talleres. Encuentra y reserva tu próximo espacio.
              </p>
            </div>
          </div>
        </Link>

        {/* Card 3: Datos Médicos */}
        <Link href="/portal/expediente" className="group">
          <div className="bg-surface rounded-xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all h-full flex flex-col items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-600 group-hover:scale-110 transition-transform">
              <Activity size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text-primary mb-1 group-hover:text-amber-600 transition-colors">
                Expediente Médico
              </h3>
              <p className="text-sm text-text-secondary">
                Gestiona tu información de salud.
              </p>
            </div>
          </div>
        </Link>

        {/* Card 4: Tienda */}
        <Link href="/portal/tienda" className="group">
          <div className="bg-surface rounded-xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all h-full flex flex-col items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600 group-hover:scale-110 transition-transform">
              <ShoppingBag size={28} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-text-primary mb-1 group-hover:text-purple-600 transition-colors">
                Tienda Holística
              </h3>
              <p className="text-sm text-text-secondary">
                Adquiere productos físicos para complementar tu bienestar.
              </p>
            </div>
          </div>
        </Link>

      </section>

    </div>
  );
}
