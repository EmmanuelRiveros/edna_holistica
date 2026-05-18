"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchAPI } from "@/lib/api";
import { Building2, Copy, CheckCheck, Loader2, AlertCircle, CalendarClock } from "lucide-react";

function TransferenciaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const queryTotal = searchParams.get("total");
  const queryReservationId = searchParams.get("reservation_id");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchSettings = async () => {
      try {
        const res = await fetchAPI("/payment-settings", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSettings(res.data.settings);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [router]);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="mt-4 text-text-secondary text-sm">Cargando datos bancarios...</p>
      </div>
    );
  }

  if (!settings || !settings.bank_name) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <AlertCircle size={64} className="text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-text-primary mb-2">Datos no disponibles</h2>
        <p className="text-text-secondary max-w-md mb-8">
          Los datos bancarios no están disponibles en este momento. Por favor contacta directamente a Edna para completar tu pago.
        </p>
        <Link
          href="/portal/reservas"
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          Ver mis reservas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mb-5">
          <Building2 size={40} className="text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">Instrucciones para tu Reserva</h1>
        <p className="text-text-secondary max-w-md">
          Tu reserva fue registrada exitosamente. Completa el pago realizando una transferencia a la siguiente cuenta.
        </p>
      </div>

      {queryTotal && queryReservationId && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center mb-8">
          <p className="text-sm text-text-secondary mb-1 uppercase tracking-wider font-semibold">Monto a transferir</p>
          <p className="text-4xl font-bold text-primary mb-2">${parseFloat(queryTotal).toFixed(2)} MXN</p>
          <p className="text-sm font-medium text-text-primary">
            Reserva: <span className="font-mono text-primary">#{queryReservationId.substring(0, 8).toUpperCase()}</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-surface rounded-xl border border-border/50 shadow-sm overflow-hidden flex flex-col">
          <div className="border-l-4 border-primary p-5 bg-background/30 border-b border-border/50">
            <h2 className="font-bold text-text-primary">Datos para transferir</h2>
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
            {[
              { label: '🏦 Banco', value: settings.bank_name, id: 'bank' },
              { label: '👤 Titular', value: settings.account_holder, id: 'holder' },
              { label: '💳 Número de cuenta', value: settings.account_number, id: 'account' },
              { label: '🔢 CLABE', value: settings.clabe, id: 'clabe' },
            ].map(item => item.value ? (
              <div key={item.id} className="flex items-center justify-between group">
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-0.5">{item.label}</p>
                  <p className="text-sm font-mono text-text-primary">{item.value}</p>
                </div>
                <button
                  onClick={() => handleCopy(item.value, item.id)}
                  title="Copiar"
                  className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  {copiedField === item.id ? <CheckCheck size={18} className="text-green-500" /> : <Copy size={18} />}
                </button>
              </div>
            ) : null)}
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 flex flex-col justify-center">
          <h2 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
            <span className="text-xl">📋</span> ¿Qué sigue?
          </h2>
          <ol className="space-y-3 text-sm text-amber-800 font-medium">
            <li className="flex gap-2">
              <span className="font-bold">1.</span> Realiza la transferencia por el monto exacto.
            </li>
            <li className="flex gap-2">
              <span className="font-bold">2.</span> Guarda tu comprobante de pago o captura de pantalla.
            </li>
            <li className="flex gap-2">
              <span className="font-bold">3.</span> Envía el comprobante a Edna junto con tu número de reserva.
            </li>
            <li className="flex gap-2">
              <span className="font-bold">4.</span> Edna verificará tu pago y confirmará tu cita en el sistema.
            </li>
            <li className="flex gap-2">
              <span className="font-bold">5.</span> Recibirás una notificación y podrás ver tu reserva como confirmada.
            </li>
          </ol>
        </div>
      </div>

      {settings.additional_info && (
        <div className="bg-surface rounded-xl border border-border/50 p-6 mb-8 text-center">
          <h3 className="font-semibold text-text-primary mb-2 text-sm uppercase tracking-wider">Información Adicional</h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {settings.additional_info}
          </p>
        </div>
      )}

      <div className="flex justify-center">
        <Link
          href="/portal/reservas"
          className="flex items-center gap-2 rounded-lg bg-primary py-3 px-8 font-semibold text-white hover:bg-primary-dark transition-colors shadow-sm"
        >
          <CalendarClock size={18} /> Ver mis reservas
        </Link>
      </div>
    </div>
  );
}

export default function PagoTransferenciaReservaPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-text-muted">Cargando...</div>}>
      <TransferenciaContent />
    </Suspense>
  );
}
