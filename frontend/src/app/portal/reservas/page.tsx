"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Clock, UserIcon, XCircle, CalendarPlus, Loader2 } from "lucide-react";

// --- Types ---
interface Reservation {
  id: string;
  scheduled_at: string;
  status: string;
  service_id: string | null;
  service_name: string | null;
  service_duration_minutes: number | null;
  workshop_id: string | null;
  workshop_name: string | null;
  therapist_first_name: string | null;
  therapist_last_name: string | null;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmada", cls: "bg-green-100 text-green-700 border-green-200" },
  cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-700 border-red-200" },
  completed: { label: "Completada", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  no_show: { label: "No asistió", cls: "bg-orange-100 text-orange-800 border-orange-200" },
};

// Formatter helper
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  const str = new Intl.DateTimeFormat("es-MX", options).format(date);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function MyReservationsPage() {
  const router = useRouter();

  // --- States ---
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // --- Fetch logic ---
  const fetchReservations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCancelError(null);

      const userStr = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!userStr || !token) {
        router.push("/login");
        return;
      }

      const user = JSON.parse(userStr);
      const clientId = user.id;

      // Note: We use native fetch to handle URL params carefully or we can rely on our fetchAPI utility.
      // Assuming fetchAPI handles full URLs or constructs based on NEXT_PUBLIC_API_URL properly.
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_URL}/reservations?client_id=${clientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al cargar las reservas");
      }

      const result = await res.json();
      setReservations(result.data.reservations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // --- Filter Logic ---
  const upcoming = reservations
    .filter((r) => r.status === "pending" || r.status === "confirmed")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const past = reservations
    .filter((r) => ["completed", "cancelled", "no_show"].includes(r.status))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const displayedReservations = filter === "upcoming" ? upcoming : past;

  // --- Cancel Logic ---
  const handleCancelClick = async (reservation: Reservation) => {
    const isConfirmed = window.confirm(
      "¿Estás seguro que deseas cancelar tu cita? Según nuestras políticas, solo puedes cancelar o reprogramar con más de 24 horas de anticipación."
    );
    if (!isConfirmed) return;

    setCancelError(null);
    setCancelLoadingId(reservation.id);

    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${API_URL}/reservations/${reservation.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "No pudimos procesar tu solicitud de cancelación.");
      }

      alert("Cita cancelada exitosamente.");
      await fetchReservations(); // Refresh list
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Ocurrió un error inesperado al intentar cancelar");
    } finally {
      setCancelLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* --- Header --- */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Mis Reservas</h1>
        <p className="text-text-secondary mt-1 max-w-2xl">
          Visualiza tus próximas citas y el historial de asistencias a terapias y talleres.
        </p>
      </div>

      {/* --- Global Error --- */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      {/* --- Cancel Error Notification --- */}
      {cancelError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center justify-between text-sm shadow-sm animate-in slide-in-from-top-2">
          <span>{cancelError}</span>
          <button onClick={() => setCancelError(null)} className="text-red-700 hover:text-red-900 px-2 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* --- Tabs --- */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setFilter("upcoming")}
          className={`pb-3 border-b-2 font-medium transition-colors text-sm px-1 ${
            filter === "upcoming"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          Próximas citas ({upcoming.length})
        </button>
        <button
          onClick={() => setFilter("past")}
          className={`pb-3 border-b-2 font-medium transition-colors text-sm px-1 ${
            filter === "past"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          Historial Pasado ({past.length})
        </button>
      </div>

      {/* --- Content Array --- */}
      <div className="pt-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border/50 rounded-xl shadow-sm">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="mt-4 text-sm text-text-secondary">Cargando tus reservaciones...</p>
          </div>
        ) : displayedReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border/50 rounded-xl shadow-sm text-center">
            {filter === "upcoming" ? (
              <>
                <CalendarDays size={48} className="text-border mb-4" />
                <h3 className="text-lg font-bold text-text-primary mb-2">No tienes citas próximas</h3>
                <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                  Tu agenda está libre. Aprovecha para explorar nuestros talleres de sanación holística y encontrar el espacio adecuado para ti.
                </p>
                <Link
                  href="/portal/agendar"
                  className="bg-primary hover:bg-primary-dark text-white font-medium px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CalendarPlus size={18} />
                  Agendar ahora
                </Link>
              </>
            ) : (
              <>
                <CalendarDays size={48} className="text-border mb-4 opacity-75" />
                <h3 className="text-lg font-bold text-text-primary mb-2">Aún no tienes historial de citas</h3>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                  Tus citas canceladas, completadas o ausencias programadas aparecerán aquí.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {displayedReservations.map((res) => {
              const b = statusConfig[res.status] || { label: res.status, cls: "bg-gray-100 text-gray-700" };
              const entityName = res.service_name || res.workshop_name || "Servicio Holístico";

              return (
                <div
                  key={res.id}
                  className="bg-surface border border-border/50 rounded-xl shadow-sm p-4 sm:p-6 transition-all hover:shadow-md flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative overflow-hidden"
                >
                  {/* Color stripe top/left based on status */}
                  <div
                    className={`absolute top-0 left-0 w-1.5 h-full ${
                      ["pending", "confirmed"].includes(res.status) ? "bg-primary" : "bg-gray-300"
                    }`}
                  ></div>

                  {/* Left Column Data */}
                  <div className="space-y-3 pl-2 flex-grow">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <h3 className="text-lg font-bold text-text-primary">{entityName}</h3>
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${b.cls}`}>
                        {b.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <CalendarDays size={16} className="text-text-muted" />
                        <span className="font-medium text-text-primary">{formatDate(res.scheduled_at)}</span>
                      </div>

                      {/* Display duration if it exists (mostly for services) */}
                      {res.service_duration_minutes && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <Clock size={16} className="text-text-muted" />
                          <span>{res.service_duration_minutes} minutos</span>
                        </div>
                      )}

                      {/* Display Therapist if exists */}
                      {(res.therapist_first_name || res.therapist_last_name) && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <UserIcon size={16} className="text-text-muted" />
                          <span>
                            {res.therapist_first_name} {res.therapist_last_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column Action */}
                  {filter === "upcoming" && (res.status === "pending" || res.status === "confirmed") && (
                    <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0 pl-2">
                      <button
                        onClick={() => handleCancelClick(res)}
                        disabled={cancelLoadingId === res.id}
                        className="w-full md:w-auto px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium rounded-lg text-danger bg-danger-light border border-red-200 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Cancelar cita"
                      >
                        {cancelLoadingId === res.id ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <XCircle size={16} />
                            Cancelar cita
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
