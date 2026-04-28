"use client";

import { useState, useEffect } from "react";
import { Activity } from "lucide-react";

export default function ExpedientePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date_of_birth: "",
    allergies: "",
    medical_conditions: "",
    preferred_contact: "email"
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await res.json();
        
        if (res.ok && data.data?.user) {
          const user = data.data.user;
          setUserId(user.id);
          
          if (user.client_profile) {
            setFormData({
              date_of_birth: user.client_profile.date_of_birth || "",
              allergies: user.client_profile.allergies || "",
              medical_conditions: user.client_profile.medical_conditions || "",
              preferred_contact: user.client_profile.preferred_contact || "email"
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!userId) return;
    
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/clients/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        // We only send the fields related to client_profile that we want to update
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        console.error("Error al actualizar perfil");
      }
    } catch (error) {
      console.error("Error en la petición:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Cargando expediente...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="text-primary" />
            Mi Expediente
          </h1>
          <p className="text-gray-500 mt-2">
            Gestiona tu información de salud y contacto.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-primary text-white rounded hover:opacity-90 transition-colors font-medium"
          >
            Editar Perfil
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Perfil actualizado correctamente.
        </div>
      )}

      <div className="bg-surface border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-6 border-b pb-2">Información Médica</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth ? formData.date_of_birth.split('T')[0] : ''}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medio de contacto preferido
              </label>
              <select
                name="preferred_contact"
                value={formData.preferred_contact}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="email">Correo Electrónico</option>
                <option value="phone">Teléfono / WhatsApp</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alergias Conocidas
            </label>
            <textarea
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              disabled={!isEditing}
              rows={3}
              placeholder="Ej: Penicilina, nueces..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condiciones Médicas o Tratamientos Actuales
            </label>
            <textarea
              name="medical_conditions"
              value={formData.medical_conditions}
              onChange={handleChange}
              disabled={!isEditing}
              rows={4}
              placeholder="Describe cualquier condición médica relevante..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>

        {isEditing && (
          <div className="mt-8 pt-6 border-t flex justify-end gap-4">
            <button
              onClick={() => {
                setIsEditing(false);
                setSaveSuccess(false);
              }}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-primary text-white rounded hover:opacity-90 transition-colors font-medium flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
