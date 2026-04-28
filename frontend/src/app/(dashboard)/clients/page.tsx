"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchAPI } from "@/lib/api";
import { Search, Users, ChevronRight, UserCircle } from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  profile: {
    photo_url: string | null;
  } | null;
}

// ── Page ────────────────────────────────────────────────────
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce search (400ms) ───────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // ── Fetch clients ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      const query = debouncedSearch
        ? `/clients?search=${encodeURIComponent(debouncedSearch)}`
        : "/clients";
      const result = await fetchAPI(query, {
        headers: { Authorization: "Bearer " + token },
      });
      setClients(result?.data?.clients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar clientes");
    } finally {
      setIsLoading(false);
    }
  }, [router, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Loading ───────────────────────────────────────────────
  if (isLoading && clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando clientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg mt-12 rounded-lg bg-danger-light p-4">
        <p className="text-danger text-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Directorio de Clientes</h1>
          <p className="text-sm text-text-secondary mt-1">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm
                       text-text-primary placeholder:text-text-muted
                       focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition"
          />
        </div>
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-12 text-center">
          <Users size={32} className="mx-auto text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            {debouncedSearch
              ? "No se encontraron clientes con esa búsqueda."
              : "No hay clientes registrados en la plataforma."}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl shadow-sm border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-4 font-semibold text-text-secondary">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">Email</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary">Teléfono</th>
                  <th className="px-6 py-4 font-semibold text-text-secondary text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-border/50 last:border-0 hover:bg-background/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {client.profile?.photo_url ? (
                          <img
                            src={client.profile.photo_url}
                            alt={`${client.first_name} ${client.last_name}`}
                            className="h-9 w-9 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserCircle size={20} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-primary">
                            {client.first_name} {client.last_name}
                          </p>
                          {!client.is_active && (
                            <span className="text-xs text-danger font-medium">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{client.email}</td>
                    <td className="px-6 py-4 text-text-secondary">{client.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <Link
                          href={`/clients/${client.id}`}
                          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium
                                     text-primary hover:bg-primary/10 transition-colors"
                        >
                          Ver expediente
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
