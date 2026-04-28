"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import {
  CreditCard,
  DollarSign,
  Download,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Payment {
  id: string;
  payment_method: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  receipt_url: string | null;
  external_reference: string | null;
  created_at: string;
  reservation_id: string;
  scheduled_at: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  service_name: string | null;
  workshop_name: string | null;
}

// ── Dictionaries ─────────────────────────────────────────────
const paymentMethods: Record<string, string> = {
  card: "Tarjeta",
  transfer: "Transferencia",
  paypal: "PayPal",
  mercadopago: "MercadoPago",
  cash: "Efectivo",
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  partial: { label: "Parcial", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  completed: { label: "Completado", cls: "bg-green-100 text-green-700 border-green-200" },
  refunded: { label: "Reembolsado", cls: "bg-red-100 text-red-700 border-red-200" },
};

// Formatter for currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

// Formatter for dates
const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
};

export default function PaymentsPage() {
  const router = useRouter();

  // State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch logic
  const fetchPayments = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    setError(null);

    let url = "/payments?";
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    
    url += params.toString();

    try {
      const response = await fetchAPI(url, {
        headers: { Authorization: "Bearer " + token },
      });
      setPayments(response?.data?.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los pagos");
    } finally {
      setIsLoading(false);
    }
  }, [router, statusFilter, debouncedSearch, startDate, endDate]);

  // Initial load and filter change
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Action: Approve Payment
  const handleApprovePayment = async (paymentId: string, totalAmount: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setActionLoadingId(paymentId);
    try {
      await fetchAPI(`/payments/${paymentId}`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify({
          status: "completed",
          paid_amount: Number(totalAmount),
        }),
      });

      // Show toast/alert
      alert("Pago aprobado exitosamente (Monto total recibido)");

      // Re-fetch to update table without refreshing page
      await fetchPayments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al aprobar el pago");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Export CSV
  const exportToCSV = () => {
    if (payments.length === 0) return;

    // 1. Defining headers
    const headers = [
      "Cliente",
      "Concepto",
      "Total",
      "Método",
      "Estado",
      "Fecha"
    ];

    // 2. Mapping rows with exactly wrapped quotes
    const rows = payments.map((item) => {
      const cliente = `${item.client_first_name || ""} ${item.client_last_name || ""}`.trim();
      const concepto = item.service_name || item.workshop_name || "Servicio / Taller";
      const total = item.total_amount;
      const metodo = paymentMethods[item.payment_method] || item.payment_method;
      const estado = statusConfig[item.status]?.label || item.status;
      const fecha = formatDate(item.scheduled_at);

      return `"${cliente}","${concepto}","${total}","${metodo}","${estado}","${fecha}"`;
    });

    // 3. Join logic
    const csvContent = [headers.join(","), ...rows].join("\n");

    // 4. File trigger
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "pagos_edna_holistica.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Control de Pagos</h1>
          <p className="text-sm text-text-secondary mt-1">
            Administra los ingresos, abonos y estatus de cobros.
          </p>
        </div>
      </div>

      {/* ── Control Bar: Search, Dates, Export ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar cliente o servicio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
          </div>

          {/* Date Filters */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-surface text-text-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
            <span className="text-text-muted text-sm">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-surface text-text-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={exportToCSV}
          disabled={payments.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex overflow-x-auto pb-2 -mb-2 gap-2 hide-scrollbar">
        {[
          { label: "Todos", value: "" },
          { label: "Pendientes", value: "pending" },
          { label: "Parciales", value: "partial" },
          { label: "Completados", value: "completed" },
          { label: "Reembolsados", value: "refunded" },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-white shadow-sm"
                : "bg-surface text-text-secondary hover:bg-background border border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table / Loading State ── */}
      {isLoading && payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 rounded-xl border border-border/50 bg-surface shadow-sm">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="mt-4 text-sm text-text-secondary">Cargando pagos...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchPayments}
            className="mt-4 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-sm"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-hidden">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <DollarSign size={40} className="text-text-muted mb-4 opacity-50" />
              <p className="text-text-secondary font-medium">No se encontraron pagos</p>
              <p className="text-sm text-text-muted mt-1">
                {statusFilter
                  ? "Intenta usar otro filtro de estado."
                  : "Cuando haya transacciones, aparecerán aquí."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="px-6 py-4 font-semibold text-text-secondary">Cliente</th>
                    <th className="px-6 py-4 font-semibold text-text-secondary">Concepto</th>
                    <th className="px-6 py-4 font-semibold text-text-secondary">Cantidades</th>
                    <th className="px-6 py-4 font-semibold text-text-secondary">Método</th>
                    <th className="px-6 py-4 font-semibold text-text-secondary">Estado</th>
                    <th className="px-6 py-4 font-semibold text-text-secondary text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const badge = statusConfig[payment.status] || {
                      label: payment.status,
                      cls: "bg-gray-100 text-gray-700 border-gray-200",
                    };

                    const canApprove =
                      payment.status === "pending" || payment.status === "partial";

                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-border/50 hover:bg-background/40 transition-colors last:border-0"
                      >
                        {/* 1. Cliente */}
                        <td className="px-6 py-4">
                          <p className="font-medium text-text-primary">
                            {payment.client_first_name} {payment.client_last_name}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5 max-w-[150px] truncate">
                            {payment.client_email}
                          </p>
                        </td>

                        {/* 2. Concepto */}
                        <td className="px-6 py-4">
                          <p className="font-medium text-text-secondary">
                            {payment.service_name || payment.workshop_name || "Servicio / Taller"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-text-muted">
                            <CalendarDays size={12} />
                            <span>{formatDate(payment.scheduled_at)}</span>
                          </div>
                        </td>

                        {/* 3. Cantidades */}
                        <td className="px-6 py-4">
                          <p className="font-medium text-text-primary">
                            {formatCurrency(payment.paid_amount)} <span className="text-text-muted font-normal">/ {formatCurrency(payment.total_amount)}</span>
                          </p>
                          {payment.pending_amount > 0 && (
                            <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-1.5 py-0.5 inline-block mt-1 font-medium border border-amber-100">
                              Faltan {formatCurrency(payment.pending_amount)}
                            </p>
                          )}
                        </td>

                        {/* 4. Método */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <CreditCard size={15} className="text-text-muted" />
                            <span className="text-text-secondary">
                              {paymentMethods[payment.payment_method] || payment.payment_method}
                            </span>
                          </div>
                        </td>

                        {/* 5. Estado */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* 6. Acciones */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* Ver Comprobante */}
                            {payment.receipt_url && (
                              <a
                                href={payment.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center h-8 w-8 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Ver comprobante"
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}

                            {/* Aprobar Pago Total */}
                            {canApprove && (
                              <button
                                onClick={() => handleApprovePayment(payment.id, payment.total_amount)}
                                disabled={actionLoadingId === payment.id}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                title="Aprobar pago total"
                              >
                                {actionLoadingId === payment.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                Aprobar Total
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
