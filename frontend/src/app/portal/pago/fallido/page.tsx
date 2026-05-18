"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { XCircle, RefreshCw, Store } from "lucide-react";

export default function PagoFallidoPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <XCircle size={80} className="text-red-500 mb-6" />
      <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">El pago no pudo procesarse</h1>
      <p className="text-text-secondary text-center mb-8 max-w-md">
        Tu pedido no fue confirmado. No se realizó ningún cargo a tu método de pago.
      </p>

      <div className="bg-surface border border-border/50 rounded-xl p-6 w-full max-w-md mb-8 space-y-3">
        <h3 className="font-semibold text-text-primary mb-3">Posibles causas:</h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Fondos insuficientes
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Datos de tarjeta incorrectos
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> El banco rechazó la transacción
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Tiempo de espera agotado
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/portal/tienda/carrito"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 px-4 font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <RefreshCw size={18} /> Intentar de nuevo
        </Link>
        <Link
          href="/portal/tienda"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-white text-text-secondary py-3 px-4 font-semibold hover:bg-background transition-colors"
        >
          <Store size={18} /> Ir a la tienda
        </Link>
      </div>
    </div>
  );
}
