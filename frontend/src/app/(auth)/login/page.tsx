"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-md w-full">
        {/* Logo */}
        <h1 className="text-primary font-bold text-2xl text-center">
          Edna Lugo Holística
        </h1>
        <p className="text-text-secondary text-center mb-6 text-sm mt-1">
          Acceso al Panel Administrativo
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
        </form>
      </div>
    </div>
  );
}
