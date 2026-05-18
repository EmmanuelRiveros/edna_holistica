"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PoliticasConfigPage() {
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'therapist') {
      router.push('/agenda');
    }
  }, [router]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Políticas de cancelación y reembolso</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configuración de políticas (En desarrollo)
        </p>
      </div>
      <div className="bg-surface shadow-sm rounded-lg border border-border/50 p-6">
        <p className="text-text-secondary">Página en construcción.</p>
      </div>
    </div>
  );
}
