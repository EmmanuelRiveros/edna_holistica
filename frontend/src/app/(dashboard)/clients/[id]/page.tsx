"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { fetchAPI } from "@/lib/api";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  AlertTriangle,
  Stethoscope,
  FileText,
  CalendarDays,
  UserCircle,
  Edit,
  Save,
  X,
  Check,
  Camera,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────
interface ClientProfile {
  id: string | null;
  date_of_birth: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  photo_url: string | null;
  preferred_contact: string | null;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  profile: ClientProfile | null;
}

interface ReservationHistory {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  service_name: string | null;
  workshop_name: string | null;
}

// ── Status badge config ─────────────────────────────────────
const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-700" },
  completed: { label: "Completada", cls: "bg-gray-100 text-gray-700" },
  no_show: { label: "No asistió", cls: "bg-orange-100 text-orange-800" },
};

// ── Preferred contact labels ────────────────────────────────
const contactLabels: Record<string, string> = {
  email: "Correo electrónico",
  phone: "Teléfono",
  whatsapp: "WhatsApp",
};

// ── Date formatter ──────────────────────────────────────────
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// ── Page ────────────────────────────────────────────────────
export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<ReservationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Medical editing state
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [isSavingMedical, setIsSavingMedical] = useState(false);
  const [editAllergies, setEditAllergies] = useState("");
  const [editConditions, setEditConditions] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationHistory | null>(null);
  const [currentNote, setCurrentNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Avatar upload state & ref
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const result = await fetchAPI(`/clients/${clientId}`, {
        headers: { Authorization: "Bearer " + token },
      });
      setClient(result?.data?.client || null);
      setHistory(result?.data?.reservation_history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el expediente");
    } finally {
      setIsLoading(false);
    }
  }, [router, clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Start editing medical data ────────────────────────────
  const startEditingMedical = () => {
    setEditAllergies(client?.profile?.allergies || "");
    setEditConditions(client?.profile?.medical_conditions || "");
    setSaveMessage(null);
    setIsEditingMedical(true);
  };

  const cancelEditingMedical = () => {
    setIsEditingMedical(false);
    setSaveMessage(null);
  };

  // ── Save medical data ─────────────────────────────────────
  const handleSaveMedical = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsSavingMedical(true);
    try {
      await fetchAPI(`/clients/${clientId}`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify({
          allergies: editAllergies || null,
          medical_conditions: editConditions || null,
        }),
      });
      setIsEditingMedical(false);
      setSaveMessage("Expediente actualizado exitosamente");
      setTimeout(() => setSaveMessage(null), 3000);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSavingMedical(false);
    }
  };

  // ── Upload Avatar Photo ───────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      // fetchAPI wrapped function doesn't easily support FormData without JSON stringify by default,
      // so we use native fetch for FormData
      const res = await fetch(`http://localhost:4000/api/v1/clients/${client.id}/photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al subir la foto");
      }

      const result = await res.json();
      const newPhotoUrl = result.data.photo_url;

      // Update state immediately
      setClient((prev) =>
        prev
          ? {
            ...prev,
            profile: {
              ...(prev.profile || {
                id: null,
                date_of_birth: null,
                allergies: null,
                medical_conditions: null,
                preferred_contact: null,
              }),
              photo_url: newPhotoUrl,
            },
          }
          : prev
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsUploadingPhoto(false);
    }
  };

  // ── Save therapeutic note ─────────────────────────────────
  const openNotesModal = (reservation: ReservationHistory) => {
    setSelectedReservation(reservation);
    setCurrentNote(reservation.notes || "");
    setIsNotesModalOpen(true);
  };

  const closeNotesModal = () => {
    setIsNotesModalOpen(false);
    setSelectedReservation(null);
    setCurrentNote("");
  };

  const saveNote = async () => {
    if (!selectedReservation) return;
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsSavingNote(true);
    try {
      await fetchAPI(`/reservations/${selectedReservation.id}/notes`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify({ notes: currentNote }),
      });
      // Optimistic update
      setHistory((prev) =>
        prev.map((r) =>
          r.id === selectedReservation.id ? { ...r, notes: currentNote } : r
        )
      );
      closeNotesModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar la nota");
    } finally {
      setIsSavingNote(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando expediente...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Volver al directorio
        </Link>
        <div className="mx-auto max-w-lg rounded-lg bg-danger-light p-4">
          <p className="text-danger text-sm text-center">{error || "Cliente no encontrado"}</p>
        </div>
      </div>
    );
  }

  const profile = client.profile;

  return (
    <div>
      {/* Back button */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Volver al directorio
      </Link>

      {/* ── CARD 1: Profile & Contact ── */}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
      />
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="relative group cursor-pointer overflow-hidden h-20 w-20 rounded-full border-2 border-border shrink-0 bg-primary/10 flex items-center justify-center text-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploadingPhoto ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={`${client.first_name} ${client.last_name}`}
                className="object-cover w-full h-full"
              />
            ) : (
              <UserCircle size={40} />
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-text-primary">
                {client.first_name} {client.last_name}
              </h1>
              {!client.is_active && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Inactivo
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted mt-0.5">
              Cliente desde {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(client.created_at))}
            </p>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail size={15} className="text-text-muted shrink-0" />
                <span className="text-text-secondary truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone size={15} className="text-text-muted shrink-0" />
                <span className="text-text-secondary">{client.phone || "Sin teléfono"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle size={15} className="text-text-muted shrink-0" />
                <div>
                  <span className="text-text-muted text-xs mr-1">Contacto preferido:</span>
                  <span className="font-medium text-text-secondary">
                    {profile?.preferred_contact
                      ? contactLabels[profile.preferred_contact] || profile.preferred_contact
                      : "No especificado"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 2: Medical Data ── */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Stethoscope size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-text-primary">Datos Médicos</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Confidencial
          </span>
          {!isEditingMedical && (
            <button
              onClick={startEditingMedical}
              className="ml-auto flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium
                         text-primary hover:bg-primary/10 transition-colors"
            >
              <Edit size={14} />
              Editar
            </button>
          )}
        </div>

        {/* Success message */}
        {saveMessage && (
          <div className="flex items-center gap-2 mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            <Check size={14} />
            {saveMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allergies */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle size={14} className="text-danger" />
              <p className="text-sm font-medium text-text-secondary">Alergias</p>
            </div>
            {isEditingMedical ? (
              <textarea
                value={editAllergies}
                onChange={(e) => setEditAllergies(e.target.value)}
                rows={3}
                placeholder="Registrar alergias..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary
                           placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/30
                           outline-none transition resize-none"
              />
            ) : profile?.allergies ? (
              <p className="text-sm bg-red-50 text-red-700 rounded-lg px-3 py-2 border border-red-100">
                {profile.allergies}
              </p>
            ) : (
              <p className="text-sm text-text-muted italic">Sin alergias registradas</p>
            )}
          </div>

          {/* Medical conditions */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText size={14} className="text-primary" />
              <p className="text-sm font-medium text-text-secondary">Condiciones Médicas</p>
            </div>
            {isEditingMedical ? (
              <textarea
                value={editConditions}
                onChange={(e) => setEditConditions(e.target.value)}
                rows={3}
                placeholder="Registrar condiciones médicas..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary
                           placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/30
                           outline-none transition resize-none"
              />
            ) : profile?.medical_conditions ? (
              <p className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2 border border-amber-100">
                {profile.medical_conditions}
              </p>
            ) : (
              <p className="text-sm text-text-muted italic">Sin condiciones registradas</p>
            )}
          </div>
        </div>

        {/* Edit action buttons */}
        {isEditingMedical && (
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <button
              onClick={cancelEditingMedical}
              disabled={isSavingMedical}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium
                         text-text-secondary hover:bg-background transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Cancelar
            </button>
            <button
              onClick={handleSaveMedical}
              disabled={isSavingMedical}
              className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium
                         text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {isSavingMedical ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Guardar
                </>
              )}
            </button>
          </div>
        )}


      </div>

      {/* ── CARD 3: Reservation History ── */}
      <div className="bg-surface rounded-xl shadow-sm border border-border/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-text-primary">Historial de Reservas</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ml-auto">
            {history.length} cita{history.length !== 1 ? "s" : ""}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays size={28} className="mx-auto text-text-muted" />
            <p className="mt-2 text-sm text-text-muted">Sin historial de citas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-4 py-3 font-semibold text-text-secondary">Fecha</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Servicio / Taller</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Estado</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary">Notas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((reservation) => {
                  const badge = statusConfig[reservation.status] || {
                    label: reservation.status,
                    cls: "bg-gray-100 text-gray-600",
                  };
                  return (
                    <tr
                      key={reservation.id}
                      className="border-b border-border/50 last:border-0 hover:bg-background/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDate(reservation.scheduled_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {reservation.service_name || reservation.workshop_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openNotesModal(reservation)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${reservation.notes
                              ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              : "text-text-muted bg-background hover:bg-border/50"
                            }`}
                        >
                          <FileText size={12} />
                          {reservation.notes ? "Ver Nota" : "Redactar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Notes Modal ── */}
      {isNotesModalOpen && selectedReservation && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={!isSavingNote ? closeNotesModal : undefined}
        >
          <div
            className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-lg font-bold text-text-primary">Notas Terapéuticas</h3>
              <button
                onClick={closeNotesModal}
                disabled={isSavingNote}
                className="rounded-lg p-1.5 text-text-muted hover:bg-background hover:text-text-primary
                           transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-text-muted mb-4">
              {selectedReservation.service_name || selectedReservation.workshop_name || "Cita"}
              {" — "}
              {formatDate(selectedReservation.scheduled_at)}
            </p>

            {/* Textarea */}
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              rows={6}
              placeholder="Escribir notas terapéuticas de la sesión..."
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-primary
                         placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/30
                         outline-none transition resize-none"
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeNotesModal}
                disabled={isSavingNote}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary
                           hover:bg-background transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveNote}
                disabled={isSavingNote}
                className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium
                           text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {isSavingNote ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Guardar Nota
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
