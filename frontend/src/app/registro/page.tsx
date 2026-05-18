"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2, Eye, EyeOff } from "lucide-react";

export default function RegistroPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = "El nombre es obligatorio.";
    if (!formData.last_name.trim()) newErrors.last_name = "El apellido es obligatorio.";
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "El correo es obligatorio.";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Ingresa un correo electrónico válido.";
    }

    if (!formData.password) {
      newErrors.password = "La contraseña es obligatoria.";
    } else if (formData.password.length < 8) {
      newErrors.password = "La contraseña debe tener al menos 8 caracteres.";
    }

    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = "Las contraseñas no coinciden.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear errors when typing
    if (errors[e.target.name]) {
      setErrors(prev => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("user", JSON.stringify(data.data.user));
        
        setTimeout(() => {
          router.push("/portal");
        }, 1500);
      } else {
        if (data.error?.toLowerCase().includes("duplicado") || data.error?.toLowerCase().includes("ya existe")) {
          setServerError("Este email ya está registrado. ¿Quieres iniciar sesión?");
        } else {
          setServerError(data.error || "Ocurrió un error al crear la cuenta.");
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      setServerError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-orange-50 to-gray-50 font-sans text-text-primary">
      {/* Columna Izquierda (Decorativa) */}
      <div className="hidden lg:flex w-1/2 bg-primary flex-col justify-center items-center text-white p-12 relative overflow-hidden">
        
        {/* Background elements */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-700/20 rounded-full blur-3xl"></div>

        <div className="z-10 w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-3 mb-12 hover:opacity-90 transition-opacity">
            <Sparkles className="w-8 h-8" />
            <span className="font-bold text-3xl tracking-tight">Edna Lugo Holística</span>
          </Link>
          
          <h1 className="text-4xl font-light leading-tight mb-4">
            Tu espacio de <br />
            <span className="font-bold">sanación personal</span>
          </h1>
          <p className="text-orange-100 text-lg font-light mb-12">
            Crea tu cuenta para comenzar a gestionar tu bienestar de manera integral.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>
              <span className="font-medium text-lg">Agenda tus citas fácilmente</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>
              <span className="font-medium text-lg">Accede a talleres exclusivos</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>
              <span className="font-medium text-lg">Gestiona tu expediente de salud</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-full"><CheckCircle2 className="w-5 h-5" /></div>
              <span className="font-medium text-lg">Tienda de productos holísticos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Derecha (Formulario) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
          
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl text-primary tracking-tight">Edna Lugo Holística</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-light mb-2">Crear mi cuenta</h2>
            <p className="text-gray-500 font-light">Es gratis y solo toma un momento</p>
          </div>

          {success ? (
            <div className="text-center py-8 animate-fade-in">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-medium text-gray-800 mb-2">¡Bienvenida!</h3>
              <p className="text-gray-500">Cuenta creada exitosamente. Redirigiendo a tu portal...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {serverError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                  {serverError}
                  {serverError.includes('iniciar sesión') && (
                    <Link href="/login" className="font-medium underline ml-1">Ir a iniciar sesión</Link>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className={`w-full p-3 rounded-xl border outline-none transition-all ${
                      errors.first_name ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100'
                    }`}
                    placeholder="Tu nombre"
                  />
                  {errors.first_name && <p className="text-red-500 text-xs mt-1.5">{errors.first_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className={`w-full p-3 rounded-xl border outline-none transition-all ${
                      errors.last_name ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100'
                    }`}
                    placeholder="Tu apellido"
                  />
                  {errors.last_name && <p className="text-red-500 text-xs mt-1.5">{errors.last_name}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full p-3 rounded-xl border outline-none transition-all ${
                    errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100'
                  }`}
                  placeholder="tucorreo@ejemplo.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono <span className="text-gray-400 font-normal">(Opcional)</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                  placeholder="+52 123 456 7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full p-3 pr-10 rounded-xl border outline-none transition-all ${
                      errors.password ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100'
                    }`}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className={`w-full p-3 pr-10 rounded-xl border outline-none transition-all ${
                      errors.confirm_password ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-orange-100'
                    }`}
                    placeholder="Repite tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirm_password && <p className="text-red-500 text-xs mt-1.5">{errors.confirm_password}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 bg-primary text-white p-3.5 rounded-xl font-medium hover:bg-primary-dark transition-colors flex justify-center items-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Crear cuenta"
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <Link href="/login" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">
              ¿Ya tienes cuenta? <span className="text-primary hover:underline">Inicia sesión →</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
