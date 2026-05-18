"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Package, Eye, Loader2, X, Truck, Store } from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Order {
  id: string;
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
  product_image_urls: string[] | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const statusConfig: Record<string, { label: string; cls: string; bg: string }> = {
  pending:    { label: "Pendiente",   cls: "text-amber-700",  bg: "bg-amber-100" },
  confirmed:  { label: "Confirmada", cls: "text-blue-700",   bg: "bg-blue-100" },
  shipped:    { label: "Enviada",    cls: "text-indigo-700", bg: "bg-indigo-100" },
  delivered:  { label: "Entregada",  cls: "text-green-700",  bg: "bg-green-100" },
  cancelled:  { label: "Cancelada",  cls: "text-red-700",    bg: "bg-red-100" },
};

export default function MisOrdenesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return null; }
    return { Authorization: "Bearer " + token };
  }, [router]);

  useEffect(() => {
    const fetchOrders = async () => {
      const headers = getHeaders();
      if (!headers) return;
      try {
        const res = await fetchAPI("/orders/my-orders?limit=50", { headers });
        setOrders(res.data.orders);
      } catch { /* ignore */ }
      finally { setIsLoading(false); }
    };
    fetchOrders();
  }, [getHeaders]);

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando órdenes...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package size={48} className="text-text-muted/30 mb-4" />
        <h2 className="text-lg font-bold text-text-primary mb-2">No tienes órdenes aún</h2>
        <p className="text-sm text-text-secondary mb-6">
          Visita nuestra tienda para hacer tu primer pedido
        </p>
        <button
          onClick={() => router.push("/portal/tienda")}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          Ir a la tienda
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Mis Órdenes</h1>

      <div className="space-y-3">
        {orders.map((o) => {
          const badge = statusConfig[o.status] || { label: o.status, cls: "text-gray-700", bg: "bg-gray-100" };
          return (
            <div
              key={o.id}
              className="bg-surface rounded-xl border border-border/50 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Order number + date */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted font-mono">
                  Orden #{o.id.substring(0, 8).toUpperCase()}
                </p>
                <p className="text-sm font-medium text-text-primary mt-0.5">
                  {new Date(o.created_at).toLocaleDateString("es-MX", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </p>
              </div>

              {/* Delivery type */}
              <span className={`inline-flex items-center gap-1 self-start sm:self-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
                o.delivery_type === "shipping"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-green-50 text-green-700"
              }`}>
                {o.delivery_type === "shipping" ? <Truck size={12} /> : <Store size={12} />}
                {o.delivery_type === "shipping" ? "Envío" : "Recoger"}
              </span>

              {/* Total */}
              <p className="text-lg font-bold text-text-primary">
                ${o.total_amount.toFixed(2)}
              </p>

              {/* Status */}
              <span className={`inline-block self-start sm:self-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.cls}`}>
                {badge.label}
              </span>

              {/* Detail button */}
              <button
                onClick={() => viewDetail(o)}
                className="flex items-center gap-1.5 rounded-lg bg-background border border-border px-3 py-2
                           text-sm font-medium text-text-secondary hover:bg-surface hover:text-primary transition-colors self-start sm:self-auto"
              >
                <Eye size={14} /> Ver detalle
              </button>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div
            className="bg-surface rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Detalle de Orden</h2>
                <p className="text-xs text-text-muted font-mono">
                  #{selectedOrder.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Summary */}
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-text-muted">Fecha</span>
                <span className="font-medium text-text-primary">
                  {new Date(selectedOrder.created_at).toLocaleDateString("es-MX", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Entrega</span>
                <span className="font-medium text-text-primary">
                  {selectedOrder.delivery_type === "shipping" ? "Envío a domicilio" : "Recoger en tienda"}
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
              {selectedOrder.notes && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Notas</span>
                  <span className="text-text-secondary text-right max-w-[60%]">{selectedOrder.notes}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Estado</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  (statusConfig[selectedOrder.status] || { bg: "bg-gray-100", cls: "text-gray-700" }).bg
                } ${(statusConfig[selectedOrder.status] || { cls: "text-gray-700" }).cls}`}>
                  {(statusConfig[selectedOrder.status] || { label: selectedOrder.status }).label}
                </span>
              </div>
            </div>

            {/* Items */}
            <h3 className="text-sm font-semibold text-text-primary mb-2">Productos</h3>
            {loadingDetail ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden mb-4">
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

            {/* Total */}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="font-semibold text-text-primary">Total</span>
              <span className="text-xl font-bold text-primary">${selectedOrder.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
