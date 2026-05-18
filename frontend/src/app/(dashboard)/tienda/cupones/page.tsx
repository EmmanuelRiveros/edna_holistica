"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Plus, Loader2, X, Trash2, Ticket } from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_purchase: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  status?: string; // computed by backend: active/expired/exhausted/inactive
}

// ── Page ────────────────────────────────────────────────────
export default function CuponesPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'therapist') {
          router.replace('/agenda');
        }
      } catch (e) {}
    }
  }, [router]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return null; }
    return { Authorization: "Bearer " + token };
  }, [router]);

  const fetchCoupons = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const res = await fetchAPI("/coupons", { headers });
      setCoupons(res.data.coupons);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [getHeaders]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleDeactivate = async (c: Coupon) => {
    if (!window.confirm(`¿Desactivar cupón "${c.code}"?`)) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await fetchAPI(`/coupons/${c.id}`, { method: "DELETE", headers });
      fetchCoupons();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  };

  const getStatusBadge = (c: Coupon) => {
    const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
    const isExhausted = c.max_uses !== null && c.used_count >= c.max_uses;

    if (!c.is_active) return { label: "Inactivo", cls: "text-gray-600", bg: "bg-gray-100" };
    if (isExpired) return { label: "Expirado", cls: "text-red-700", bg: "bg-red-100" };
    if (isExhausted) return { label: "Agotado", cls: "text-orange-700", bg: "bg-orange-100" };
    return { label: "Activo", cls: "text-green-700", bg: "bg-green-100" };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando cupones...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Cupones</h1>
          <p className="text-sm text-text-secondary mt-1">
            {coupons.length} cupón{coupons.length !== 1 && "es"}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold
                     text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} /> Nuevo Cupón
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-muted">Código</th>
              <th className="px-4 py-3 font-medium text-text-muted">Tipo</th>
              <th className="px-4 py-3 font-medium text-text-muted">Valor</th>
              <th className="px-4 py-3 font-medium text-text-muted">Usos</th>
              <th className="px-4 py-3 font-medium text-text-muted">Vencimiento</th>
              <th className="px-4 py-3 font-medium text-text-muted">Estado</th>
              <th className="px-4 py-3 font-medium text-text-muted text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                  No hay cupones creados.
                </td>
              </tr>
            ) : (
              coupons.map((c) => {
                const badge = getStatusBadge(c);
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-background transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Ticket size={14} className="text-primary shrink-0" />
                        <span className="font-mono font-bold text-text-primary">{c.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.discount_type === "percentage" ? "Porcentaje" : "Monto fijo"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      {c.discount_type === "percentage"
                        ? `${c.discount_value}%`
                        : `$${c.discount_value.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.used_count}{c.max_uses !== null ? `/${c.max_uses}` : "/∞"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {c.expires_at
                        ? new Date(c.expires_at).toLocaleDateString("es-MX", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                        : "Sin vencimiento"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.is_active && (
                        <button
                          onClick={() => handleDeactivate(c)}
                          title="Desactivar"
                          className="rounded-lg p-2 text-text-secondary hover:bg-danger-light hover:text-danger transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <CouponModal
          getHeaders={getHeaders}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchCoupons(); }}
        />
      )}
    </div>
  );
}

// ── Coupon Create Modal ─────────────────────────────────────
function CouponModal({
  getHeaders,
  onClose,
  onSaved,
}: {
  getHeaders: () => Record<string, string> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_purchase: "",
    max_uses: "",
    expires_at: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.code.trim() || !form.discount_value) {
      return alert("Código y valor de descuento son obligatorios");
    }

    const headers = getHeaders();
    if (!headers) return;

    const body: any = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
    };
    if (form.min_purchase) body.min_purchase = parseFloat(form.min_purchase);
    if (form.max_uses) body.max_uses = parseInt(form.max_uses, 10);
    if (form.expires_at) body.expires_at = new Date(form.expires_at).toISOString();

    setIsSaving(true);
    try {
      await fetchAPI("/coupons", {
        method: "POST", headers, body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear cupón");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Nuevo Cupón</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Código *</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="DESCUENTO20"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Tipo *</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Valor *</label>
              <input
                type="number"
                min="0"
                max={form.discount_type === "percentage" ? 100 : undefined}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Min purchase + Max uses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Compra mínima</label>
              <input
                type="number"
                min="0"
                value={form.min_purchase}
                onChange={(e) => setForm({ ...form, min_purchase: e.target.value })}
                placeholder="Opcional"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Usos máximos</label>
              <input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Ilimitado"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Fecha de vencimiento</label>
            <input
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSaving ? "Creando..." : "Crear Cupón"}
          </button>
        </div>
      </div>
    </div>
  );
}
