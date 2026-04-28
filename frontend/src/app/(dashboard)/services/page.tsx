"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Edit, Trash2, Plus, Sparkles, CalendarDays } from "lucide-react";
import CreateRecordModal from "@/components/CreateRecordModal";

// ── Interfaces ──────────────────────────────────────────────
interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
}

interface Workshop {
  id: string;
  name: string;
  type: string;
  starts_at: string;
  max_capacity: number;
  price: number;
  status: string;
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const statusLabels: Record<string, { text: string; cls: string }> = {
  draft:     { text: "Borrador",   cls: "bg-gray-100 text-gray-600" },
  published: { text: "Publicado",  cls: "bg-success-light text-success" },
  cancelled: { text: "Cancelado",  cls: "bg-danger-light text-danger" },
  finished:  { text: "Finalizado", cls: "bg-primary/10 text-primary" },
};

// ── Página ──────────────────────────────────────────────────
export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "workshops">("services");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);

  // Extracted data-loading function so the modal can trigger a refresh
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const headers = { Authorization: "Bearer " + token };

    try {
      const [servicesResult, workshopsResult] = await Promise.allSettled([
        fetchAPI("/services", { headers }),
        fetchAPI("/workshops", { headers }),
      ]);

      if (servicesResult.status === "fulfilled") {
        setServices(servicesResult.value?.data?.services || []);
      } else {
        console.error("Error cargando servicios:", servicesResult.reason);
        setServices([]);
      }

      if (workshopsResult.status === "fulfilled") {
        setWorkshops(workshopsResult.value?.data?.workshops || []);
      } else {
        console.error("Error cargando talleres:", workshopsResult.reason);
        setWorkshops([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Edit handler ──
  const handleEdit = (record: Record<string, any>) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  // ── Delete handler ──
  const handleDelete = async (id: string, type: "services" | "workshops") => {
    const label = type === "services" ? "servicio" : "taller";
    if (!window.confirm(`¿Estás seguro de eliminar este ${label}?`)) return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      await fetchAPI(`/${type}/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar el registro");
    }
  };

  // ── Close modal & clear editing state ──
  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando catálogo...</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="mx-auto max-w-lg mt-12 rounded-lg bg-danger-light p-4">
        <p className="text-danger text-sm text-center">{error}</p>
      </div>
    );
  }

  const tabs = [
    { key: "services" as const, label: "Servicios",  icon: Sparkles,     count: services.length },
    { key: "workshops" as const, label: "Talleres",   icon: CalendarDays, count: workshops.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Catálogo</h1>
          <p className="text-sm text-text-secondary mt-1">
            Gestión de servicios y talleres
          </p>
        </div>
        <button
          onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium
                     text-white hover:bg-primary-dark transition-colors duration-150"
        >
          <Plus size={16} />
          Nuevo Registro
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6" role="tablist">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150
              ${
                activeTab === key
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }
            `}
          >
            <Icon size={16} />
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold
                ${activeTab === key ? "bg-primary/10 text-primary" : "bg-gray-100 text-text-muted"}
              `}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === "services" ? (
        <ServicesTable services={services} onEdit={handleEdit} onDelete={(id) => handleDelete(id, "services")} />
      ) : (
        <WorkshopsTable workshops={workshops} onEdit={handleEdit} onDelete={(id) => handleDelete(id, "workshops")} />
      )}

      {/* Modal para crear nuevo registro */}
      <CreateRecordModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        type={activeTab}
        onSuccess={fetchData}
        initialData={editingRecord ?? undefined}
      />
    </div>
  );
}

// ── Tabla de Servicios ──────────────────────────────────────
function ServicesTable({ services, onEdit, onDelete }: { services: Service[]; onEdit: (item: Service) => void; onDelete: (id: string) => void }) {
  if (services.length === 0) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-12 text-center">
        <Sparkles size={32} className="mx-auto text-text-muted" />
        <p className="mt-3 text-sm text-text-muted">
          No hay servicios registrados en la plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50">
              <th className="px-6 py-4 font-semibold text-text-secondary">Nombre</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Duración</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Precio</th>
              <th className="px-6 py-4 font-semibold text-text-secondary text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-border/50 last:border-0 hover:bg-background/30 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-text-primary">{service.name}</p>
                  {service.description && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                      {service.description}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 text-text-secondary">
                  {service.duration_minutes} min
                </td>
                <td className="px-6 py-4 font-semibold text-text-primary">
                  {formatCurrency(service.price)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      aria-label="Editar servicio"
                      onClick={() => onEdit(service)}
                      className="rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      aria-label="Eliminar servicio"
                      onClick={() => onDelete(service.id)}
                      className="rounded-lg p-2 text-text-muted hover:bg-danger-light hover:text-danger transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tabla de Talleres ───────────────────────────────────────
function WorkshopsTable({ workshops, onEdit, onDelete }: { workshops: Workshop[]; onEdit: (item: Workshop) => void; onDelete: (id: string) => void }) {
  if (workshops.length === 0) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-12 text-center">
        <CalendarDays size={32} className="mx-auto text-text-muted" />
        <p className="mt-3 text-sm text-text-muted">
          No hay talleres registrados en la plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-background/50">
              <th className="px-6 py-4 font-semibold text-text-secondary">Nombre</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Tipo</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Fecha</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Capacidad</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Precio</th>
              <th className="px-6 py-4 font-semibold text-text-secondary">Estado</th>
              <th className="px-6 py-4 font-semibold text-text-secondary text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {workshops.map((workshop) => {
              const badge = statusLabels[workshop.status] || {
                text: workshop.status,
                cls: "bg-gray-100 text-gray-600",
              };
              return (
                <tr key={workshop.id} className="border-b border-border/50 last:border-0 hover:bg-background/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary">
                    {workshop.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      workshop.type === 'presencial'
                        ? 'bg-green-100 text-green-700'
                        : workshop.type === 'virtual'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {workshop.type === 'presencial' ? 'Presencial'
                       : workshop.type === 'virtual' ? 'Virtual'
                       : 'Híbrido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {workshop.starts_at ? formatDate(workshop.starts_at) : "—"}
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {workshop.max_capacity} personas
                  </td>
                  <td className="px-6 py-4 font-semibold text-text-primary">
                    {formatCurrency(workshop.price)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        aria-label="Editar taller"
                        onClick={() => onEdit(workshop)}
                        className="rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        aria-label="Eliminar taller"
                        onClick={() => onDelete(workshop.id)}
                        className="rounded-lg p-2 text-text-muted hover:bg-danger-light hover:text-danger transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
