"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Save, Clock, Loader2, Info, CheckCircle2, ShieldCheck } from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ── Constants ───────────────────────────────────────────────
const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const buildDefaultSchedule = (): DaySchedule[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    start_time: "09:00",
    end_time: "17:00",
    is_active: false,
  }));

// ── Page Component ──────────────────────────────────────────
export default function DisponibilidadPage() {
  const router = useRouter();

  // State
  const [schedule, setSchedule] = useState<DaySchedule[]>(buildDefaultSchedule());
  const [cancellationWindowHours, setCancellationWindowHours] = useState(24);
  const [refundPercentageBeforeWindow, setRefundPercentageBeforeWindow] = useState(100);
  const [refundPercentageAfterWindow, setRefundPercentageAfterWindow] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Auth header helper ────────────────────────────────────
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return null;
    }
    return { Authorization: "Bearer " + token };
  }, [router]);

  // ── Fetch initial availability ────────────────────────────
  useEffect(() => {
    const fetchAvailability = async () => {
      const headers = getAuthHeaders();
      if (!headers) return;

      try {
        const result = await fetchAPI("/availability/me", { headers });
        const { availability, settings } = result.data;

        // Merge response with default schedule
        const merged = buildDefaultSchedule().map((defaultDay) => {
          const found = availability.find(
            (a: DaySchedule) => a.day_of_week === defaultDay.day_of_week
          );
          if (found) {
            return {
              day_of_week: found.day_of_week,
              start_time: found.start_time?.substring(0, 5) || "09:00",
              end_time: found.end_time?.substring(0, 5) || "17:00",
              is_active: found.is_active,
            };
          }
          return defaultDay;
        });

        setSchedule(merged);

        // Hydrate cancellation policy from settings
        if (settings) {
          setCancellationWindowHours(settings.cancellation_window_hours ?? 24);
          setRefundPercentageBeforeWindow(settings.refund_percentage_before_window ?? 100);
          setRefundPercentageAfterWindow(settings.refund_percentage_after_window ?? 0);
        }
      } catch {
        // If no availability yet, keep defaults — no error needed
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [getAuthHeaders]);

  // ── Handlers ──────────────────────────────────────────────
  const toggleDay = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === dayIndex ? { ...d, is_active: !d.is_active } : d
      )
    );
  };

  const updateTime = (dayIndex: number, field: "start_time" | "end_time", value: string) => {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === dayIndex ? { ...d, [field]: value } : d
      )
    );
  };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    // Validate: end_time > start_time for active days
    for (const day of schedule) {
      if (day.is_active && day.start_time >= day.end_time) {
        setMessage({
          type: "error",
          text: `La hora de fin debe ser posterior a la hora de inicio para ${DAY_NAMES[day.day_of_week]}`,
        });
        return;
      }
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await fetchAPI("/availability/me", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          availability: schedule.map((d) => ({
            day_of_week: d.day_of_week,
            start_time: d.start_time,
            end_time: d.end_time,
            is_active: d.is_active,
          })),
          settings: {
            cancellation_window_hours: cancellationWindowHours,
            refund_percentage_before_window: refundPercentageBeforeWindow,
            refund_percentage_after_window: refundPercentageAfterWindow,
          },
        }),
      });

      setMessage({ type: "success", text: "Disponibilidad guardada exitosamente" });

      // Auto-dismiss success after 4s
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al guardar disponibilidad",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando disponibilidad...</p>
      </div>
    );
  }

  const activeDays = schedule.filter((d) => d.is_active).length;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Mi Disponibilidad</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configura tus horarios de atención semanales
        </p>
      </div>

      {/* Toast message */}
      {message && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-300 ${
            message.type === "success"
              ? "bg-success-light text-green-800"
              : "bg-danger-light text-red-800"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={16} /> : <Info size={16} />}
          {message.text}
        </div>
      )}

      {/* ── Section 1: Weekly Schedule ── */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-text-primary">Horario semanal</h2>
          <span className="ml-auto text-xs text-text-muted bg-background rounded-full px-2.5 py-0.5">
            {activeDays} {activeDays === 1 ? "día activo" : "días activos"}
          </span>
        </div>

        {/* Table header — desktop */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_80px_1fr_1fr] gap-3 mb-2 px-3">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Día</span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider text-center">Activo</span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Inicio</span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Fin</span>
        </div>

        {/* Day rows */}
        <div className="space-y-2">
          {schedule.map((day) => (
            <div
              key={day.day_of_week}
              className={`grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr_1fr] gap-3 items-center
                          rounded-lg px-3 py-3 transition-colors duration-150
                          ${day.is_active
                            ? "bg-primary/5 border border-primary/20"
                            : "bg-background border border-transparent hover:border-border"
                          }`}
            >
              {/* Day name */}
              <span
                className={`text-sm font-medium ${
                  day.is_active ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {DAY_NAMES[day.day_of_week]}
              </span>

              {/* Toggle */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => toggleDay(day.day_of_week)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                              transition-colors duration-200 ease-in-out focus:outline-none
                              ${day.is_active ? "bg-primary" : "bg-gray-300"}`}
                  role="switch"
                  aria-checked={day.is_active}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full
                                bg-white shadow ring-0 transition duration-200 ease-in-out
                                ${day.is_active ? "translate-x-5" : "translate-x-0.5"}
                                mt-0.5`}
                  />
                </button>
              </div>

              {/* Start time */}
              <div>
                <label className="sm:hidden text-xs text-text-muted mb-1 block">Inicio</label>
                <input
                  type="time"
                  value={day.start_time}
                  onChange={(e) => updateTime(day.day_of_week, "start_time", e.target.value)}
                  disabled={!day.is_active}
                  className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors
                              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                              ${day.is_active
                                ? "border-border bg-white text-text-primary"
                                : "border-transparent bg-gray-100 text-text-muted cursor-not-allowed"
                              }`}
                />
              </div>

              {/* End time */}
              <div>
                <label className="sm:hidden text-xs text-text-muted mb-1 block">Fin</label>
                <input
                  type="time"
                  value={day.end_time}
                  onChange={(e) => updateTime(day.day_of_week, "end_time", e.target.value)}
                  disabled={!day.is_active}
                  className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors
                              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                              ${day.is_active
                                ? "border-border bg-white text-text-primary"
                                : "border-transparent bg-gray-100 text-text-muted cursor-not-allowed"
                              }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Info note ── */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-5 lg:p-6 mb-6">
        <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            El tiempo de descanso entre citas se configura en cada servicio del catálogo.
          </p>
        </div>
      </div>

      {/* ── Section 2: Cancellation Policy ── */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-5 lg:p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-text-primary">
            Políticas de Cancelación y Reembolso
          </h2>
        </div>

        <div className="space-y-5">
          {/* Rule 1: Cancellation window */}
          <p className="text-sm text-text-secondary leading-relaxed">
            El cliente puede cancelar o reagendar su cita hasta{" "}
            <input
              type="number"
              min={0}
              value={cancellationWindowHours}
              onChange={(e) => setCancellationWindowHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="inline-block w-16 rounded-md border border-border bg-white px-2 py-1 text-sm
                         text-center font-semibold text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-colors mx-1"
            />
            {" "}horas antes de la cita.
          </p>

          {/* Rule 2: Refund before window */}
          <p className="text-sm text-text-secondary leading-relaxed">
            Si cancela{" "}
            <span className="font-semibold text-green-700">ANTES</span>
            {" "}del límite de tiempo, se le reembolsará el{" "}
            <input
              type="number"
              min={0}
              max={100}
              value={refundPercentageBeforeWindow}
              onChange={(e) => setRefundPercentageBeforeWindow(
                Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
              )}
              className="inline-block w-16 rounded-md border border-border bg-white px-2 py-1 text-sm
                         text-center font-semibold text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-colors mx-1"
            />
            {" "}% del pago total.
          </p>

          {/* Rule 3: Refund after window */}
          <p className="text-sm text-text-secondary leading-relaxed">
            Si cancela{" "}
            <span className="font-semibold text-red-600">DESPUÉS</span>
            {" "}del límite de tiempo (o no asiste), se le reembolsará el{" "}
            <input
              type="number"
              min={0}
              max={100}
              value={refundPercentageAfterWindow}
              onChange={(e) => setRefundPercentageAfterWindow(
                Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
              )}
              className="inline-block w-16 rounded-md border border-border bg-white px-2 py-1 text-sm
                         text-center font-semibold text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-colors mx-1"
            />
            {" "}% del pago.
          </p>
        </div>

        {/* Preview summary */}
        <div className="mt-5 rounded-lg bg-background border border-border/50 px-4 py-3">
          <p className="text-xs text-text-muted">
            <span className="font-semibold">Resumen:</span>{" "}
            Cancelación libre hasta {cancellationWindowHours}h antes → reembolso {refundPercentageBeforeWindow}%.
            Después → reembolso {refundPercentageAfterWindow}%.
          </p>
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold
                     text-white shadow-sm hover:bg-primary-dark active:scale-[0.98]
                     transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? "Guardando..." : "Guardar Disponibilidad"}
        </button>
      </div>
    </div>
  );
}
