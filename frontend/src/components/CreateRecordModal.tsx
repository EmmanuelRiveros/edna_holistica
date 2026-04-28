"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";

// ── Initial state constants (numbers as empty strings to avoid "0900" bug) ──
const initialService = { name: "", description: "", duration_minutes: "", price: "" };
const initialWorkshop = { name: "", type: "presencial", starts_at: "", ends_at: "", max_capacity: "", price: "" };

// ── Types ───────────────────────────────────────────────────
interface CreateRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "services" | "workshops";
  onSuccess: () => void;
  initialData?: Record<string, any>;
}

// ── Component ───────────────────────────────────────────────
export default function CreateRecordModal({
  isOpen,
  onClose,
  type,
  onSuccess,
  initialData,
}: CreateRecordModalProps) {
  const buildInitial = () => {
    if (initialData) {
      const data = { ...initialData };
      // Adapt ISO dates for datetime-local inputs
      if (data.starts_at) data.starts_at = data.starts_at.slice(0, 16);
      if (data.ends_at) data.ends_at = data.ends_at.slice(0, 16);
      return data;
    }
    return type === "services" ? { ...initialService } : { ...initialWorkshop };
  };

  const [formData, setFormData] = useState<Record<string, any>>(buildInitial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when the modal opens or the tab changes
  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitial());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type]);

  // ── Handle input changes (supports input, textarea, select) ──
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type: inputType } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: inputType === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  // ── Submit logic ────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Basic validation
    if (!formData.name || formData.price === "" || Number(formData.price) < 0) {
      setError("Por favor ingresa un nombre y un precio válido");
      return;
    }

    // Token check
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Sesión expirada. Inicia sesión nuevamente.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Build payload with correct types for the backend
      const payload: Record<string, any> = { ...formData };
      payload.price = Number(formData.price);

      if (type === "services") {
        payload.duration_minutes = Number(formData.duration_minutes);
      } else if (type === "workshops") {
        payload.max_capacity = Number(formData.max_capacity);
        payload.starts_at = new Date(formData.starts_at).toISOString();
        payload.ends_at = new Date(formData.ends_at).toISOString();
      }

      const method = initialData ? "PUT" : "POST";
      const url = initialData ? `/${type}/${initialData.id}` : `/${type}`;

      await fetchAPI(url, {
        method,
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify(payload),
      });

      // Success — reset, notify parent, close
      setFormData(type === "services" ? { ...initialService } : { ...initialWorkshop });
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al guardar el registro"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Early return ────────────────────────────────────────
  if (!isOpen) return null;

  // ── Shared input classes ────────────────────────────────
  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary " +
    "placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition";

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={!isSubmitting ? onClose : undefined}
    >
      {/* Container */}
      <div
        className="bg-surface rounded-lg p-6 w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2 className="text-xl font-bold mb-4 text-text-primary">
          {initialData
            ? type === "services" ? "Editar Servicio" : "Editar Taller"
            : type === "services" ? "Nuevo Servicio" : "Nuevo Taller"}
        </h2>

        {/* Error feedback */}
        {error && (
          <div className="bg-danger-light text-danger p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          {/* ── Common fields ── */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nombre
            </label>
            <input
              type="text"
              name="name"
              value={formData.name ?? ""}
              onChange={handleChange}
              required
              className={inputCls}
              placeholder="Nombre del registro"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Precio (MXN)
            </label>
            <input
              type="number"
              name="price"
              value={formData.price ?? ""}
              onChange={handleChange}
              min="0"
              required
              className={inputCls}
              placeholder="0"
            />
          </div>

          {/* ── Service-specific fields ── */}
          {type === "services" && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={formData.description ?? ""}
                  onChange={handleChange}
                  rows={3}
                  className={inputCls}
                  placeholder="Descripción del servicio (opcional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Duración (minutos)
                </label>
                <input
                  type="number"
                  name="duration_minutes"
                  value={formData.duration_minutes ?? ""}
                  onChange={handleChange}
                  min="0"
                  className={inputCls}
                  placeholder="60"
                />
              </div>
            </>
          )}

          {/* ── Workshop-specific fields ── */}
          {type === "workshops" && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Tipo
                </label>
                <select
                  name="type"
                  value={formData.type ?? "presencial"}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Fecha de inicio
                </label>
                <input
                  type="datetime-local"
                  name="starts_at"
                  value={formData.starts_at ?? ""}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Fecha de fin
                </label>
                <input
                  type="datetime-local"
                  name="ends_at"
                  value={formData.ends_at ?? ""}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Capacidad máxima
                </label>
                <input
                  type="number"
                  name="max_capacity"
                  value={formData.max_capacity ?? ""}
                  onChange={handleChange}
                  min="1"
                  className={inputCls}
                  placeholder="20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Estado
                </label>
                <select
                  name="status"
                  value={formData.status ?? "draft"}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="finished">Finalizado</option>
                </select>
              </div>
            </>
          )}

          {/* ── Buttons ── */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary
                         hover:bg-background transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white
                         hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
