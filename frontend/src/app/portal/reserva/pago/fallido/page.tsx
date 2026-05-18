"use client";

import Link from "next/link";
import { XCircle } from "lucide-react";

export default function ReservaFallidoPage() {
  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <div className="flex justify-center mb-6">
        <XCircle size={80} className="text-red-500" />
      </div>
      <h1 className="text-4xl font-bold text-text-primary mb-4">El pago no pudo procesarse</h1>
      <p className="text-lg text-text-secondary mb-8">
        Tu reserva sigue pendiente. Intenta pagar de nuevo desde tus reservas.
      </p>
      <Link
        href="/portal/reservas"
        className="inline-block rounded-lg bg-gray-200 text-gray-800 px-8 py-3 font-semibold hover:bg-gray-300 transition-colors"
      >
        Volver a mis reservas
      </Link>
    </div>
  );
}
