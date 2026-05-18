"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import moment from "moment";
import "moment/locale/es";
import { fetchAPI } from "@/lib/api";
import {
  X,
  User,
  Users,
  Sparkles,
  CalendarDays,
  Clock,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

// ── react-big-calendar: dynamic import (SSR-safe) ──────────
import type {
  View,
  Event as RBCEvent,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { momentLocalizer } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";

// Localizer con moment en español
moment.locale("es");
const localizer = momentLocalizer(moment);

// Calendar envuelto con DnD — cargado dinámicamente para evitar SSR issues
const DnDCalendar = withDragAndDrop(
  dynamic(() => import("react-big-calendar").then((mod) => mod.Calendar), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center" style={{ minHeight: "80vh" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ),
  }) as any
);

// ── Types ───────────────────────────────────────────────────
interface Reservation {
  id: string;
  client_first_name?: string;
  client_last_name?: string;
  service_id?: string | null;
  service_name?: string | null;
  service_duration_minutes?: number | null;
  workshop_id?: string | null;
  workshop_name?: string | null;
  therapist_first_name?: string | null;
  therapist_last_name?: string | null;
  scheduled_at?: string;
  status: string;

  // Workshop-event fields (empty workshops — Source 3)
  name?: string;
  max_capacity?: number;
  type?: string;
}

interface CalendarEvent extends RBCEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Reservation;
  type: string;
  status: string;
}

// ── Status config ───────────────────────────────────────────
const statusConfig: Record<string, { label: string; cls: string; bg: string }> = {
  pending: { label: "Pendiente", cls: "text-amber-700", bg: "bg-amber-100" },
  confirmed: { label: "Confirmada", cls: "text-green-700", bg: "bg-green-100" },
  cancelled: { label: "Cancelada", cls: "text-red-700", bg: "bg-red-100" },
  completed: { label: "Completada", cls: "text-gray-700", bg: "bg-gray-100" },
  no_show: { label: "No asistió", cls: "text-orange-800", bg: "bg-orange-100" },
};

// ── Messages in Spanish ─────────────────────────────────────
const calendarMessages = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "No hay citas en este rango.",
  showMore: (count: number) => `+${count} más`,
};

// ── Page Component ──────────────────────────────────────────
export default function AgendaPage() {
  const router = useRouter();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Auth header helper ────────────────────────────────────
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return null;
    }
    return { Authorization: "Bearer " + token };
  }, [router]);

  // ── Fetch agenda events ─────────────────────────────────────
  const fetchData = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const result = await fetchAPI("/agenda", { headers });
      const agendaEvents: any[] = result?.data?.events || [];

      const mapped: CalendarEvent[] = agendaEvents.map((ev: any) => ({
        id: ev.id,
        title: ev.title,
        start: new Date(ev.start),
        end: new Date(ev.end),
        resource: ev,
        type: ev.entity,
        status: ev.status,
      }));

      setEvents(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la agenda");
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Event styles (color coding) ───────────────────────────
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const base: React.CSSProperties = {
      backgroundColor: event.type === "service" ? "#3b82f6" : "#f97316",
      borderRadius: "6px",
      color: "#fff",
      border: "none",
      fontSize: "0.8rem",
      padding: "2px 6px",
    };

    if (event.status === "cancelled") {
      base.opacity = 0.4;
      base.textDecoration = "line-through";
    } else if (event.status === "completed") {
      base.opacity = 0.6;
    } else if (event.status === "pending") {
      base.border = "2px dashed rgba(255,255,255,0.6)";
    }

    return { style: base };
  }, []);

  // ── Drag & Drop: reschedule ───────────────────────────────
  const handleEventDrop = useCallback(
    async (args: EventInteractionArgs<CalendarEvent>) => {
      const { event, start } = args;

      // Preserve the original time-of-day only in month view;
      // in week/day views, use the exact time where the event was dropped.
      const originalStart = new Date(event.start);
      const adjustedStart = new Date(start instanceof Date ? start : new Date(start));
      if (view === "month") {
        adjustedStart.setHours(originalStart.getHours(), originalStart.getMinutes());
      }

      // Keep the original duration
      const durationMs = new Date(event.end).getTime() - originalStart.getTime();
      const adjustedEnd = new Date(adjustedStart.getTime() + durationMs);

      // Optimistic update
      const prevEvents = [...events];
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, start: adjustedStart, end: adjustedEnd }
            : e
        )
      );

      const headers = getAuthHeaders();
      if (!headers) return;

      // Dynamic routing: workshops vs reservations
      const isWorkshop = event.type === "workshop";
      const endpoint = isWorkshop
        ? `/workshops/${event.id}/reschedule`
        : `/reservations/${event.id}/reschedule`;
      const payload = isWorkshop
        ? { starts_at: adjustedStart.toISOString(), ends_at: adjustedEnd.toISOString() }
        : { scheduled_at: adjustedStart.toISOString() };

      try {
        await fetchAPI(endpoint, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
      } catch (err) {
        // Revert on failure
        setEvents(prevEvents);
        alert(err instanceof Error ? err.message : "Error al reprogramar la cita");
      }
    },
    [events, view, getAuthHeaders]
  );

  // ── Status change ─────────────────────────────────────────
  const handleStatusChange = useCallback(
    async (id: string, newStatus: string, reasonOrNotes?: string) => {
      const headers = getAuthHeaders();
      if (!headers) return;

      setIsUpdating(true);
      try {
        const payload: any = { status: newStatus };
        if (reasonOrNotes) {
          if (newStatus === "cancelled") payload.cancellation_reason = reasonOrNotes;
          else if (newStatus === "completed") payload.notes = reasonOrNotes;
        }

        await fetchAPI(`/reservations/${id}/status`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
        setSelectedEvent(null);
        await fetchData();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error al actualizar el estado");
      } finally {
        setIsUpdating(false);
      }
    },
    [getAuthHeaders, fetchData]
  );

  // ── Legend items ──────────────────────────────────────────
  const legendItems = useMemo(
    () => [
      { color: "#3b82f6", label: "Servicio" },
      { color: "#f97316", label: "Taller" },
    ],
    []
  );

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando agenda...</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-lg mt-12 rounded-lg bg-danger-light p-4">
        <p className="text-danger text-sm text-center">{error}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
          <p className="text-sm text-text-secondary mt-1">
            Calendario de citas y talleres
          </p>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-gray-400" />
            Pendiente
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-4 lg:p-6">
        <DnDCalendar
          localizer={localizer}
          events={events}
          view={view}
          onView={(v: View) => setView(v)}
          date={date}
          onNavigate={(d: Date) => setDate(d)}
          views={["month", "week", "day"]}
          style={{ minHeight: "80vh" }}
          messages={calendarMessages}
          eventPropGetter={eventPropGetter as any}
          onSelectEvent={((event: CalendarEvent) => setSelectedEvent(event)) as any}
          onEventDrop={handleEventDrop as any}
          resizable={false}
          popup
          selectable
          step={30}
          timeslots={2}
        />
      </div>

      {/* ── Event Detail Modal ── */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          isUpdating={isUpdating}
          onClose={() => setSelectedEvent(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ── Event Detail Modal Component ────────────────────────────
function EventModal({
  event,
  isUpdating,
  onClose,
  onStatusChange,
}: {
  event: CalendarEvent;
  isUpdating: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: string, reason?: string) => void;
}) {
  const r = event.resource;

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeNotes, setCompleteNotes] = useState((r as any)?.notes || "");
  const isWorkshopEvent = event.type === "workshop";
  const hasClient = Boolean(r?.client_first_name && r?.client_last_name);
  const badge = statusConfig[event.status] || {
    label: event.status,
    cls: "text-gray-700",
    bg: "bg-gray-100",
  };

  const formattedDate = moment(event.start).format("dddd, D [de] MMMM [de] YYYY");
  const formattedTime = `${moment(event.start).format("h:mm A")} — ${moment(event.end).format("h:mm A")}`;

  // Resolve the display name for the service/workshop
  const entityName = r.service_name || r.workshop_name || r.name || event.title || "—";

  const showActions =
    !isWorkshopEvent && !["completed", "cancelled", "no_show"].includes(event.status);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={!isUpdating ? onClose : undefined}
    >
      <div
        className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {showCompleteModal ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-lg font-bold text-text-primary">
                Completar Sesión
              </h2>
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={isUpdating}
                className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Notas de la sesión (Opcional)
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="Escribe observaciones, evolución o detalles de la sesión..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                disabled={isUpdating}
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                Volver
              </button>
              <button
                disabled={isUpdating}
                onClick={() => onStatusChange(event.id, "completed", completeNotes)}
                className="flex-1 rounded-lg bg-green-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-600 transition-colors disabled:opacity-60"
              >
                {isUpdating ? "Guardando..." : "Guardar y Completar"}
              </button>
            </div>
          </div>
        ) : showCancelModal ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-lg font-bold text-text-primary">
                ¿Seguro que deseas cancelar esta cita?
              </h2>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isUpdating}
                className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Motivo de la cancelación (El cliente recibirá este mensaje)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="Opcional..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                disabled={isUpdating}
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                Volver
              </button>
              <button
                disabled={isUpdating}
                onClick={() => onStatusChange(event.id, "cancelled", cancelReason)}
                className="flex-1 rounded-lg bg-red-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {isUpdating ? "Cancelando..." : "Confirmar Cancelación"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {isWorkshopEvent ? "Detalle de Taller" : "Detalle de Reserva"}
                </h2>
                <span
                  className={`inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <button
                onClick={onClose}
                disabled={isUpdating}
                className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary
                       transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Info rows */}
            <div className="space-y-3 text-sm">
              {/* Cliente — only when client data exists */}
              {hasClient && (
                <InfoRow
                  icon={<User size={16} className="text-primary" />}
                  label="Cliente"
                  value={`${r.client_first_name} ${r.client_last_name}`}
                />
              )}

              {/* Servicio / Taller */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {event.type === "service" ? (
                    <Sparkles size={16} className="text-blue-500" />
                  ) : (
                    <CalendarDays size={16} className="text-orange-500" />
                  )}
                </div>
                <div>
                  <p className="text-text-muted text-xs">
                    {event.type === "service" ? "Servicio" : "Taller"}
                  </p>
                  <p className="text-text-primary font-medium">{entityName}</p>
                  {isWorkshopEvent && r.max_capacity && (
                    <p className="text-text-secondary text-xs mt-0.5">
                      <Users size={12} className="inline mr-1" />
                      Capacidad: {r.max_capacity} personas
                    </p>
                  )}
                  {isWorkshopEvent && (
                    <p className="text-text-muted text-xs mt-1 italic">
                      * Aún no hay clientes inscritos.
                    </p>
                  )}
                </div>
              </div>

              {/* Terapeuta — only for reservations */}
              {!isWorkshopEvent && r.therapist_first_name && (
                <InfoRow
                  icon={<Stethoscope size={16} className="text-emerald-500" />}
                  label="Terapeuta"
                  value={`${r.therapist_first_name} ${r.therapist_last_name}`}
                />
              )}

              <InfoRow
                icon={<CalendarDays size={16} className="text-text-muted" />}
                label="Fecha"
                value={formattedDate}
              />
              <InfoRow
                icon={<Clock size={16} className="text-text-muted" />}
                label="Horario"
                value={formattedTime}
              />
            </div>

            {/* Action Buttons — only for reservations */}
            {showActions && (
              <div className="mt-6 pt-4 border-t border-border">
                {event.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      disabled={isUpdating}
                      onClick={() => onStatusChange(event.id, "confirmed")}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2.5
                             text-sm font-medium text-white hover:bg-green-600 transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      Confirmar
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => setShowCancelModal(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2.5
                             text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
                    >
                      <XCircle size={16} />
                      Cancelar
                    </button>
                  </div>
                )}

                {event.status === "confirmed" && (
                  <div className="flex gap-2">
                    <button
                      disabled={isUpdating}
                      onClick={() => setShowCompleteModal(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gray-600 px-3 py-2.5
                             text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      Completada
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => onStatusChange(event.id, "no_show")}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2.5
                             text-sm font-medium text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
                    >
                      <AlertTriangle size={16} />
                      No asistió
                    </button>
                    <button
                      disabled={isUpdating}
                      onClick={() => setShowCancelModal(true)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2.5
                             text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                )}

                {isUpdating && (
                  <p className="text-center text-xs text-text-muted mt-2">Actualizando...</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Info Row ─────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-text-muted text-xs">{label}</p>
        <p className="text-text-primary font-medium">{value}</p>
      </div>
    </div>
  );
}
