"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { Clock, Package } from "lucide-react";

export default function PagoPendientePage() {
  const router = useRouter();
  const { clearCart } = useCart();

  const hasCleared = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    if (!hasCleared.current) {
      hasCleared.current = true;
      clearCart();
    }
  }, [router, clearCart]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <Clock size={80} className="text-yellow-500 mb-6" />
      <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">Pago en revisión</h1>
      <p className="text-text-secondary text-center mb-8 max-w-md">
        Tu pago está siendo procesado por MercadoPago. Te avisaremos cuando se acredite.
      </p>

      <div className="bg-surface border border-border/50 rounded-xl p-6 w-full max-w-md mb-8 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">⏱</span>
          <p className="text-sm text-text-secondary leading-relaxed">
            Esto puede tardar hasta 24 horas dependiendo del método seleccionado.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xl">📧</span>
          <p className="text-sm text-text-secondary leading-relaxed">
            Te notificaremos por correo electrónico en cuanto se confirme tu orden.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xl">❓</span>
          <p className="text-sm text-text-secondary leading-relaxed">
            Si tienes alguna duda o problema, contacta a Edna directamente.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/portal/mis-ordenes"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 px-4 font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Package size={18} /> Ver mis órdenes
        </Link>
      </div>
    </div>
  );
}
