"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // 🌟 Importación agregada
import { fetchAPI } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetchAPI("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const token = response.data.token;
      const user = response.data.user;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      const role = response.data.user.role;
      if (role === 'client') {
        router.push('/portal');
      } else if (role === 'admin') {
        router.push('/dashboard');
      } else if (role === 'therapist') {
        router.push('/agenda');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">

      {/* 🌟 Botón para volver al inicio */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm flex items-center gap-2 text-text-secondary hover:text-primary transition-colors duration-150"
      >
        ← Volver al inicio
      </Link>

      <div className="bg-surface p-8 rounded-lg shadow-md max-w-md w-full">
        {/* Logo */}
        <h1 className="text-primary font-bold text-2xl text-center">
          Edna Lugo Holística
        </h1>
        <p className="text-text-secondary text-center mb-6 text-sm mt-1">
          Accede a tu cuenta
        </p>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                         text-text-primary placeholder-text-muted
                         focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                         transition-colors duration-150"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                         text-text-primary placeholder-text-muted
                         focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                         transition-colors duration-150"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-danger text-sm mt-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary hover:bg-primary-dark text-white font-medium
                       py-2.5 text-sm transition-colors duration-150
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Cargando..." : "Iniciar Sesión"}
          </button>

          {/* 🌟 Enlace de registro */}
          <div className="text-center text-sm text-text-secondary mt-6 pt-4 border-t border-border">
            ¿No tienes una cuenta?{" "}
            <Link
              href="/register"
              className="text-primary font-medium hover:underline transition-all"
            >
              Regístrate aquí
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}