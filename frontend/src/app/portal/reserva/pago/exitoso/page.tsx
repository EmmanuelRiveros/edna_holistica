"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

function ExitosoContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("reservation_id");

  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center">
      <div className="flex justify-center mb-6">
        <CheckCircle size={80} className="text-green-500" />
      </div>
      <h1 className="text-4xl font-bold text-text-primary mb-4">¡Reserva confirmada!</h1>
      <p className="text-lg text-text-secondary mb-8">
        Tu cita ha sido agendada y el pago procesado exitosamente.
        {reservationId && (
          <span className="block mt-2 text-sm text-text-muted">
            Folio: {reservationId.substring(0, 8).toUpperCase()}
          </span>
        )}
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

export default function ReservaExitosoPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Cargando...</div>}>
      <ExitosoContent />
    </Suspense>
  );
}
