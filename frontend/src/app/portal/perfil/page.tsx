"use client";

import { useState, useEffect, FormEvent } from "react";
import { fetchAPI } from "@/lib/api";
import { Mail, Phone, Loader2, CheckCircle2 } from "lucide-react";

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<any>(null);
  
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [dataSuccess, setDataSuccess] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setPhone(parsedUser.phone || "");
      setEmail(parsedUser.email || "");
    }
  }, []);

  const handleDataSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsDataLoading(true);
    setDataError("");
    setDataSuccess("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetchAPI(`/clients/${user.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, email }),
      });

      // La respuesta del endpoint PUT trae el client actualizado en res.data.client
      const updatedUser = res.data?.client || { ...user, phone, email };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setDataSuccess("Datos actualizados correctamente");

      // Limpiar mensaje de éxito después de un tiempo
      setTimeout(() => setDataSuccess(""), 3000);

    } catch (err: any) {
      setDataError(err.message || "Error al actualizar los datos");
    } finally {
      setIsDataLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Ajustes de Perfil</h1>
        <p className="text-text-secondary text-lg">Actualiza tus datos de contacto personales.</p>
      </div>

      <div className="bg-surface border border-border/50 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-text-primary mb-6">Información Personal</h2>
        
        <form onSubmit={handleDataSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Mail size={16} className="text-text-muted" />
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                           transition-colors duration-150"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Phone size={16} className="text-text-muted" />
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm
                           text-text-primary placeholder-text-muted
                           focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                           transition-colors duration-150"
              />
            </div>
          </div>

          {dataError && <p className="text-danger text-sm">{dataError}</p>}
          
          {dataSuccess && (
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={18} />
              {dataSuccess}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border/50">
            <button
              type="submit"
              disabled={isDataLoading || (email === user.email && phone === (user.phone || ""))}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-sm"
            >
              {isDataLoading && <Loader2 size={18} className="animate-spin" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
