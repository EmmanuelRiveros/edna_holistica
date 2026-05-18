"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import {
  Eye, Loader2, X, Truck, Store,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Order {
  id: string;
  client_id: string;
  client_first_name: string;
  client_last_name: string;
  status: string;
  delivery_type: string;
  total_amount: number;
  shipping_address: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// ── Status config ───────────────────────────────────────────
const statusConfig: Record<string, { label: string; cls: string; bg: string }> = {
  pending:    { label: "Pendiente",   cls: "text-amber-700",  bg: "bg-amber-100" },
  confirmed:  { label: "Confirmada", cls: "text-blue-700",   bg: "bg-blue-100" },
  shipped:    { label: "Enviada",    cls: "text-indigo-700", bg: "bg-indigo-100" },
  delivered:  { label: "Entregada",  cls: "text-green-700",  bg: "bg-green-100" },
  cancelled:  { label: "Cancelada",  cls: "text-red-700",    bg: "bg-red-100" },
};

const TABS = [
  { key: "", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "confirmed", label: "Confirmadas" },
  { key: "shipped", label: "Enviadas" },
  { key: "delivered", label: "Entregadas" },
  { key: "cancelled", label: "Canceladas" },
];

// ── Page ────────────────────────────────────────────────────
export default function OrdenesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const fetchOrders = useCallback(async (statusFilter = "") => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      const qs = statusFilter ? `?status=${statusFilter}&limit=100` : "?limit=100";
      const res = await fetchAPI(`/orders${qs}`, { headers });
      setOrders(res.data.orders);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [getHeaders]);

  useEffect(() => { fetchOrders(activeTab); }, [fetchOrders, activeTab]);

  // ── View detail ───────────────────────────────────────────
  const viewDetail = async (order: Order) => {
    const headers = getHeaders();
    if (!headers) return;
    setSelectedOrder(order);
    setLoadingDetail(true);
    try {
      const res = await fetchAPI(`/orders/${order.id}`, { headers });
      setOrderItems(res.data.items);
    } catch { setOrderItems([]); }
    finally { setLoadingDetail(false); }
  };

  // ── Change status ─────────────────────────────────────────
  const changeStatus = async (orderId: string, newStatus: string) => {
    const headers = getHeaders();
    if (!headers) return;
    if (newStatus === "cancelled" && !window.confirm("¿Cancelar esta orden? Se restaurará el stock.")) return;

    setIsUpdating(true);
    try {
      await fetchAPI(`/orders/${orderId}/status`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: newStatus }),
      });
      setSelectedOrder(null);
      fetchOrders(activeTab);
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setIsUpdating(false); }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando órdenes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Órdenes de Compra</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setIsLoading(true); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-white"
                : "bg-surface border border-border text-text-secondary hover:bg-background"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-text-muted">Cliente</th>
              <th className="px-4 py-3 font-medium text-text-muted">Tipo</th>
              <th className="px-4 py-3 font-medium text-text-muted">Total</th>
              <th className="px-4 py-3 font-medium text-text-muted">Estado</th>
              <th className="px-4 py-3 font-medium text-text-muted">Fecha</th>
              <th className="px-4 py-3 font-medium text-text-muted text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                  No hay órdenes.
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const badge = statusConfig[o.status] || { label: o.status, cls: "text-gray-700", bg: "bg-gray-100" };
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-background transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {o.client_first_name} {o.client_last_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        o.delivery_type === "shipping"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {o.delivery_type === "shipping" ? <Truck size={12} /> : <Store size={12} />}
                        {o.delivery_type === "shipping" ? "Envío" : "Recoger"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-text-primary">
                      ${o.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(o.created_at).toLocaleDateString("es-MX", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => viewDetail(o)}
                        className="rounded-lg p-2 text-text-secondary hover:bg-background hover:text-primary transition-colors"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div
            className="bg-surface rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">Detalle de Orden</h2>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Order info */}
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-text-muted">Cliente</span>
                <span className="font-medium text-text-primary">
                  {selectedOrder.client_first_name} {selectedOrder.client_last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Tipo</span>
                <span className="font-medium text-text-primary">
                  {selectedOrder.delivery_type === "shipping" ? "Envío" : "Recoger en tienda"}
                </span>
              </div>
              {selectedOrder.shipping_address && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Dirección</span>
                  <span className="font-medium text-text-primary text-right max-w-[60%]">
                    {selectedOrder.shipping_address}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Total</span>
                <span className="font-bold text-text-primary text-lg">
                  ${selectedOrder.total_amount.toFixed(2)}
                </span>
              </div>
              {selectedOrder.notes && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Notas</span>
                  <span className="text-text-secondary text-right max-w-[60%]">{selectedOrder.notes}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <h3 className="text-sm font-semibold text-text-primary mb-2">Productos</h3>
            {loadingDetail ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background text-text-muted text-left">
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium text-center">Cant.</th>
                      <th className="px-3 py-2 font-medium text-right">Precio</th>
                      <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.id} className="border-t border-border/50">
                        <td className="px-3 py-2 text-text-primary">{item.product_name}</td>
                        <td className="px-3 py-2 text-center text-text-secondary">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-text-secondary">${item.unit_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium text-text-primary">${item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Change status */}
            {!["delivered", "cancelled"].includes(selectedOrder.status) && (
              <div className="border-t border-border pt-4">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Cambiar estado
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === "pending" && (
                    <button
                      disabled={isUpdating}
                      onClick={() => changeStatus(selectedOrder.id, "confirmed")}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                  )}
                  {["pending", "confirmed"].includes(selectedOrder.status) && (
                    <button
                      disabled={isUpdating}
                      onClick={() => changeStatus(selectedOrder.id, "shipped")}
                      className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-60"
                    >
                      Marcar Enviada
                    </button>
                  )}
                  {selectedOrder.status === "shipped" && (
                    <button
                      disabled={isUpdating}
                      onClick={() => changeStatus(selectedOrder.id, "delivered")}
                      className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors disabled:opacity-60"
                    >
                      Marcar Entregada
                    </button>
                  )}
                  <button
                    disabled={isUpdating}
                    onClick={() => changeStatus(selectedOrder.id, "cancelled")}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
                  >
                    Cancelar Orden
                  </button>
                </div>
                {isUpdating && (
                  <p className="text-xs text-text-muted mt-2">Actualizando...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
