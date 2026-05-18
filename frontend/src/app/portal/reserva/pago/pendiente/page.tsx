"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

export default function ReservaPendientePage() {
  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <div className="flex justify-center mb-6">
        <Clock size={80} className="text-yellow-500" />
      </div>
      <h1 className="text-4xl font-bold text-text-primary mb-4">Pago en revisión</h1>
      <p className="text-lg text-text-secondary mb-8">
        Hemos recibido tu intención de pago. Tu reserva se confirmará automáticamente en cuanto el procesador lo apruebe.
      </p>
      <Link
        href="/portal/reservas"
        className="inline-block rounded-lg bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-dark transition-colors"
      >
        Ver mis reservas
      </Link>
    </div>
  );
}
