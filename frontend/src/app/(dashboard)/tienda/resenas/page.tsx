"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { Check, X, Trash2, Star, Loader2 } from "lucide-react";

type TabStatus = "pending" | "approved" | "rejected";

export default function ModeracionResenasPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabStatus>("pending");
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

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

  const fetchReviews = useCallback(async (status: TabStatus) => {
    const headers = getHeaders();
    if (!headers) return;
    setIsLoading(true);
    try {
      const res = await fetchAPI(`/reviews?status=${status}&limit=50`, { headers });
      setReviews(res.data.reviews || []);
      
      // Si estamos en pendientes, actualizar el badge. 
      // O podríamos hacer un fetch rápido extra si estamos en otra tab
      if (status === "pending") {
        setPendingCount(res.data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  // Fetch initial pending count just once to feed the badge if we start in another tab
  useEffect(() => {
    const fetchPendingCount = async () => {
      const headers = getHeaders();
      if (!headers) return;
      try {
        const res = await fetchAPI(`/reviews?status=pending&limit=1`, { headers });
        setPendingCount(res.data.total || 0);
      } catch (err) { /* ignore */ }
    };
    fetchPendingCount();
  }, [getHeaders]);

  useEffect(() => {
    fetchReviews(activeTab);
  }, [activeTab, fetchReviews]);

  const handleModerate = async (id: string, newStatus: "approved" | "rejected") => {
    const headers = getHeaders();
    if (!headers) return;
    try {
      await fetchAPI(`/reviews/${id}/moderate`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      // Si aprobamos/rechazamos desde pendientes, restar uno
      if (activeTab === "pending") {
        setPendingCount(prev => Math.max(0, prev - 1));
      }
      // Refrescar lista sin recargar
      fetchReviews(activeTab);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error moderando reseña");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar esta reseña? Esta acción no se puede deshacer.")) return;
    const headers = getHeaders();
    if (!headers) return;
    try {
      await fetchAPI(`/reviews/${id}`, { method: "DELETE", headers });
      if (activeTab === "pending") {
        setPendingCount(prev => Math.max(0, prev - 1));
      }
      fetchReviews(activeTab);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error eliminando reseña");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Moderación de Reseñas</h1>
        <p className="text-sm text-text-secondary mt-1">
          Aprueba o rechaza las reseñas de los clientes antes de que sean visibles.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "pending" 
              ? "border-primary text-primary" 
              : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
          }`}
        >
          Pendientes
          {pendingCount > 0 && (
            <span className="bg-red-100 text-red-700 py-0.5 px-2 rounded-full text-xs">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "approved" 
              ? "border-primary text-primary" 
              : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
          }`}
        >
          Aprobadas
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "rejected" 
              ? "border-primary text-primary" 
              : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
          }`}
        >
          Rechazadas
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16">
            <Star size={40} className="mx-auto text-text-muted/30 mb-3" />
            <p className="text-text-secondary text-sm">No hay reseñas en esta categoría.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-background border-b border-border text-text-muted">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Calificación</th>
                  <th className="px-4 py-3 font-medium min-w-[200px]">Comentario</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-background/50">
                    <td className="px-4 py-3 font-medium text-text-primary max-w-[150px] truncate">
                      {r.product_name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {r.first_name} {r.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star} 
                            size={14} 
                            className={star <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} 
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.comment ? (
                        <span title={r.comment}>
                          {r.comment.length > 100 ? `${r.comment.substring(0, 100)}...` : r.comment}
                        </span>
                      ) : (
                        <span className="text-text-muted italic">Sin comentario</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab !== "approved" && (
                          <button
                            onClick={() => handleModerate(r.id, "approved")}
                            title="Aprobar"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {activeTab !== "rejected" && (
                          <button
                            onClick={() => handleModerate(r.id, "rejected")}
                            title="Rechazar"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-text-muted hover:bg-gray-100 hover:text-red-600 transition-colors"
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
        )}
      </div>
    </div>
  );
}
