"use client";

import { useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { CheckCircle, Package, ArrowRight } from "lucide-react";

function ExitosoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();

  const externalReference = searchParams.get("external_reference") || searchParams.get("order_id");

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
      <CheckCircle size={80} className="text-green-500 mb-6" />
      <h1 className="text-3xl font-bold text-text-primary mb-2 text-center">¡Pago exitoso!</h1>
      <p className="text-text-secondary text-center mb-6 max-w-md">
        Tu pedido ha sido confirmado y está siendo preparado.
      </p>

      {externalReference && (
        <div className="bg-background border border-border/50 rounded-lg px-4 py-2 mb-8 inline-block">
          <p className="text-sm font-medium text-text-primary">
            Número de orden: <span className="font-mono text-primary">{externalReference.substring(0, 8).toUpperCase()}</span>
          </p>
        </div>
      )}

      <div className="bg-surface border border-border/50 rounded-xl p-6 w-full max-w-md mb-8 space-y-4">
        <h3 className="font-semibold text-text-primary mb-2">Próximos pasos</h3>
        <div className="flex items-start gap-3">
          <span className="text-xl">📦</span>
          <p className="text-sm text-text-secondary leading-relaxed">
            Recibirás tu pedido en 3-5 días hábiles a la dirección proporcionada.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xl">📧</span>
          <p className="text-sm text-text-secondary leading-relaxed">
            Te enviaremos actualizaciones del estado de tu envío por email.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/portal/mis-ordenes"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 px-4 font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Package size={18} /> Ver mis órdenes
        </Link>
        <Link
          href="/portal/tienda"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-primary text-primary py-3 px-4 font-semibold hover:bg-primary/5 transition-colors"
        >
          Seguir comprando <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}

export default function PagoExitosoPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-text-muted">Cargando...</div>}>
      <ExitosoContent />
    </Suspense>
  );
}
