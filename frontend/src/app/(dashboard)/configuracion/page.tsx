"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Loader2, Pencil, CheckCircle2, Save, X, ShieldCheck } from "lucide-react";

export default function ConfiguracionPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [availabilityData, setAvailabilityData] = useState<any[]>([]);
  const [cancellationWindowHours, setCancellationWindowHours] = useState(24);
  const [refundPercentageBeforeWindow, setRefundPercentageBeforeWindow] = useState(100);
  const [refundPercentageAfterWindow, setRefundPercentageAfterWindow] = useState(0);

  const [form, setForm] = useState({
    bank_name: "",
    account_holder: "",
    account_number: "",
    clabe: "",
    additional_info: "",
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'therapist') {
          router.replace('/agenda');
        }
      } catch (e) { }
    }
  }, [router]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return null;
    }
    return { Authorization: "Bearer " + token };
  }, [router]);

  // Fetch initial data
  const fetchSettings = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;

    try {
      const res = await fetchAPI("/payment-settings", { headers });
      const data = res.data.settings;
      if (data) {
        setForm({
          bank_name: data.bank_name || "",
          account_holder: data.account_holder || "",
          account_number: data.account_number || "",
          clabe: data.clabe || "",
          additional_info: data.additional_info || "",
        });
      }
    } catch (error) {
      console.error("Error cargando configuración bancaria:", error);
    }

    try {
      const res = await fetchAPI("/availability/me", { headers });
      const { availability, settings } = res.data;
      if (availability) {
        setAvailabilityData(availability);
      }
      if (settings) {
        setCancellationWindowHours(settings.cancellation_window_hours ?? 24);
        setRefundPercentageBeforeWindow(settings.refund_percentage_before_window ?? 100);
        setRefundPercentageAfterWindow(settings.refund_percentage_after_window ?? 0);
      }
    } catch (error) {
      console.error("Error cargando políticas de cancelación:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Save
  const handleSave = async () => {
    // Validaciones basicas
    if (form.clabe && form.clabe.length !== 18) {
      return alert("La CLABE debe tener exactamente 18 dígitos.");
    }

    const headers = getHeaders();
    if (!headers) return;

    setIsSaving(true);
    setSuccessMsg("");

    try {
      await fetchAPI("/payment-settings", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          bank_name: form.bank_name || null,
          account_holder: form.account_holder || null,
          account_number: form.account_number || null,
          clabe: form.clabe || null,
          additional_info: form.additional_info || null,
        }),
      });

      await fetchAPI("/availability/me", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          availability: availabilityData,
          settings: {
            cancellation_window_hours: cancellationWindowHours,
            refund_percentage_before_window: refundPercentageBeforeWindow,
            refund_percentage_after_window: refundPercentageAfterWindow,
          },
        }),
      });

      setSuccessMsg("Datos guardados correctamente");
      setIsEditing(false);

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsLoading(true);
    fetchSettings(); // Recargar datos originales
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Configuración de Pagos</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configura los datos bancarios para pagos por transferencia
        </p>
      </div>

      {successMsg && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-sm font-medium text-green-800 border border-green-200">
          <CheckCircle2 size={18} className="text-green-600" />
          {successMsg}
        </div>
      )}

      <div className="bg-surface shadow-sm rounded-lg border border-border/50 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Datos Bancarios</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 rounded-lg bg-background border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface hover:text-primary transition-colors"
            >
              <Pencil size={16} /> Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Bank Name & Account Holder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Nombre del banco
              </label>
              <input
                type="text"
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                readOnly={!isEditing}
                placeholder="Ej. BBVA, Banamex..."
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default"
                  : "bg-white border-border text-text-primary"
                  }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Titular de la cuenta
              </label>
              <input
                type="text"
                value={form.account_holder}
                onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                readOnly={!isEditing}
                placeholder="Nombre completo"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default"
                  : "bg-white border-border text-text-primary"
                  }`}
              />
            </div>
          </div>

          {/* Account Number & CLABE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Número de cuenta
              </label>
              <input
                type="text"
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/[^0-9]/g, '') })}
                readOnly={!isEditing}
                placeholder="Solo números"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default font-mono"
                  : "bg-white border-border text-text-primary font-mono"
                  }`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-text-secondary">
                  CLABE interbancaria
                </label>
                {isEditing && (
                  <span className={`text-xs font-medium ${form.clabe.length === 18 ? "text-green-600" : "text-text-muted"
                    }`}>
                    {form.clabe.length}/18
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={18}
                value={form.clabe}
                onChange={(e) => setForm({ ...form, clabe: e.target.value.replace(/[^0-9]/g, '') })}
                readOnly={!isEditing}
                placeholder="18 dígitos"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default font-mono"
                  : "bg-white border-border text-text-primary font-mono"
                  }`}
              />
            </div>
          </div>

          {/* Additional Info */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Información adicional (Instrucciones para el cliente)
            </label>
            <textarea
              rows={3}
              value={form.additional_info}
              onChange={(e) => setForm({ ...form, additional_info: e.target.value })}
              readOnly={!isEditing}
              placeholder="Ej. Por favor enviar el comprobante de pago por WhatsApp..."
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none ${!isEditing
                ? "bg-background border-transparent text-text-primary cursor-default"
                : "bg-white border-border text-text-primary"
                }`}
            />
          </div>
        </div>
      </div>

      {/* ── Cancellation Policy ── */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-text-primary">
              Políticas de Cancelación y Reembolso
            </h2>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 rounded-lg bg-background border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface hover:text-primary transition-colors"
            >
              <Pencil size={16} /> Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X size={16} /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Rule 1: Cancellation window */}
          <p className="text-sm text-text-secondary leading-relaxed">
            El cliente puede cancelar o reagendar su cita hasta{" "}
            <input
              type="number"
              min={0}
              value={cancellationWindowHours}
              disabled={!isEditing}
              onChange={(e) => setCancellationWindowHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className={`inline-block w-16 rounded-md border px-2 py-1 text-sm
                         text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-colors mx-1
                         ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default"
                  : "bg-white border-border text-text-primary"}`}
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
              disabled={!isEditing}
              onChange={(e) => setRefundPercentageBeforeWindow(
                Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
              )}
              className={`inline-block w-16 rounded-md border px-2 py-1 text-sm
                         text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-colors mx-1
                         ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default"
                  : "bg-white border-border text-text-primary"}`}
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
              disabled={!isEditing}
              onChange={(e) => setRefundPercentageAfterWindow(
                Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
              )}
              className={`inline-block w-16 rounded-md border px-2 py-1 text-sm
                         text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-colors mx-1
                         ${!isEditing
                  ? "bg-background border-transparent text-text-primary cursor-default"
                  : "bg-white border-border text-text-primary"}`}
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
    </div>
  );
}
