"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import {
  DollarSign,
  AlertCircle,
  Users,
  CalendarClock,
  TrendingUp,
  Sparkles,
} from "lucide-react";

// ── Interfaces ──────────────────────────────────────────────
interface MetricRevenue {
  total_billed: number;
  total_paid: number;
  total_pending: number;
}
interface MetricClients {
  total: number;
  active: number;
}
interface MetricStatus {
  pending: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  no_show: number;
}
interface MetricService {
  service_id: string;
  name: string;
  reservations_count: number;
}
interface MetricWorkshop {
  workshop_id: string;
  name: string;
  reservations_count: number;
  max_capacity: number;
}
interface DashboardMetrics {
  revenue: MetricRevenue;
  clients: MetricClients;
  reservations_by_status: MetricStatus;
  top_services: MetricService[];
  top_workshops: MetricWorkshop[];
}

// ── Helpers ─────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ── Componente de tarjeta KPI ───────────────────────────────
function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="bg-surface rounded-xl shadow-sm p-6 flex items-start gap-4 border border-border/50">
      <div className={`rounded-lg p-2.5 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{title}</p>
        <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
      </div>
    </div>
  );
}

// ── Componente de lista ─────────────────────────────────────
function RankingCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border/50">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border/50">
        <Icon size={18} className="text-primary" />
        <h3 className="font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const response = await fetchAPI("/dashboard", {
          headers: { Authorization: "Bearer " + token },
        });
        setMetrics(response.data.metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar métricas");
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, []);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando métricas...</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertCircle size={32} className="text-danger" />
        <p className="mt-3 text-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Resumen general del negocio
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ingresos Totales"
          value={formatCurrency(metrics?.revenue?.total_billed ?? 0)}
          icon={DollarSign}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Pagos Pendientes"
          value={formatCurrency(metrics?.revenue?.total_pending ?? 0)}
          icon={AlertCircle}
          iconColor="text-warning"
          iconBg="bg-warning-light"
        />
        <StatCard
          title="Clientes Registrados"
          value={metrics?.clients?.total ?? 0}
          icon={Users}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard
          title="Citas Pendientes"
          value={metrics?.reservations_by_status?.pending ?? 0}
          icon={CalendarClock}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
      </div>

      {/* ── Rankings ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Top 5 Servicios */}
        <RankingCard title="Top 5 Servicios" icon={TrendingUp}>
          {metrics?.top_services && metrics.top_services.length > 0 ? (
            <ul className="space-y-3">
              {metrics.top_services.map((service, i) => (
                <li
                  key={service.service_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-primary">
                      {service.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-text-secondary">
                    {service.reservations_count} reservas
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">
              No hay datos
            </p>
          )}
        </RankingCard>

        {/* Top 5 Talleres */}
        <RankingCard title="Top 5 Talleres" icon={Sparkles}>
          {metrics?.top_workshops && metrics.top_workshops.length > 0 ? (
            <ul className="space-y-3">
              {metrics.top_workshops.map((workshop, i) => (
                <li
                  key={workshop.workshop_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-primary">
                      {workshop.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-text-secondary">
                    {workshop.reservations_count} / {workshop.max_capacity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted text-center py-4">
              No hay datos
            </p>
          )}
        </RankingCard>
      </div>
    </div>
  );
}
