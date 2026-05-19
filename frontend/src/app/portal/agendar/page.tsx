"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Building2, Banknote, CreditCard, Wallet, CircleDollarSign } from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
  deposit_amount: string;
  is_active: boolean;
}

interface Workshop {
  id: string;
  name: string;
  description: string;
  type: string;
  starts_at: string;
  ends_at: string;
  max_capacity: number;
  price: string;
  deposit_amount: string;
  status: string;
}

export default function AgendarPage() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<'service' | 'workshop' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Service | Workshop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para la Fase 2
  const [selectedTherapist, setSelectedTherapist] = useState<any | null>(null);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState<boolean>(false);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);

  // Estados para la Fase 3
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Estados para la Fase 4 (Pago)
  const [paymentType, setPaymentType] = useState<'deposit' | 'full' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'mercadopago' | 'transfer' | 'cash' | null>(null);
  const [createdReservationId, setCreatedReservationId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        const [servicesRes, workshopsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/services?limit=100`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/workshops?status=published&limit=100`, { headers })
        ]);

        if (servicesRes.ok && workshopsRes.ok) {
          const servicesData = await servicesRes.json();
          const workshopsData = await workshopsRes.json();

          // Ajustamos para acceder a la data según la estructura: response.data.services
          const rawServices = servicesData.data?.services || servicesData.services || [];
          const rawWorkshops = workshopsData.data?.workshops || workshopsData.workshops || [];

          const activeServices = rawServices.filter((s: Service) => s.is_active === true);

          setServices(activeServices);
          setWorkshops(rawWorkshops);
        } else {
          console.error('Error fetching data');
        }
      } catch (error) {
        console.error('Error en fetch:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (step === 2 && selectedType === 'service' && selectedItem) {
      setIsLoadingTherapists(true);
      const token = localStorage.getItem('token');
      
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/services/${selectedItem.id}/therapists`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        const list = data.data?.therapists || [];
        setTherapists(list);
        setIsLoadingTherapists(false);
        // Si solo hay un terapeuta, seleccionarlo automáticamente
        if (list.length === 1) {
          setSelectedTherapist(list[0]);
        }
      })
      .catch(() => setIsLoadingTherapists(false));
    }
  }, [step, selectedType, selectedItem]);

  useEffect(() => {
    if (step === 2 && selectedType === 'service' && selectedDate && selectedTherapist) {
      setIsLoadingSlots(true);
      const token = localStorage.getItem('token');
      
      const url = `${process.env.NEXT_PUBLIC_API_URL}/availability/slots` +
        `?therapist_id=${selectedTherapist.id}` +
        `&date=${selectedDate}` +
        `&service_id=${selectedItem?.id}`;
      
      fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setAvailableSlots(data.data?.slots || []);
        setIsLoadingSlots(false);
      })
      .catch(() => {
        setAvailableSlots([]);
        setIsLoadingSlots(false);
      });
    }
  }, [selectedDate, selectedTherapist, step, selectedType, selectedItem]);

  const handleSelectService = (service: Service) => {
    setSelectedType('service');
    setSelectedItem(service);
    setStep(2);
  };

  const handleSelectWorkshop = (workshop: Workshop) => {
    setSelectedType('workshop');
    setSelectedItem(workshop);
    setStep(2);
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(amount));
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-CL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date) + ' hrs';
    } catch {
      return dateString;
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      let body = {};
      if (selectedType === 'service') {
        body = {
          service_id: selectedItem.id,
          therapist_id: selectedTherapist?.id,
          scheduled_at: `${selectedDate}T${selectedTime}:00`
        };
      } else if (selectedType === 'workshop') {
        body = {
          workshop_id: selectedItem.id,
          scheduled_at: (selectedItem as Workshop).starts_at
        };
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reservations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        const resId = data.data?.reservation?.id || data.reservation?.id || data.id;
        setCreatedReservationId(resId);
        
        const depositAmount = Number(selectedItem.deposit_amount) || 0;
        if (depositAmount === 0) {
          setPaymentType('full');
        }
        
        setStep(4);
      } else {
        const errorMsg = data.message || data.error || 'Error al procesar la reserva';
        if (errorMsg.toLowerCase().includes('cupos')) {
          setSubmitError('Lo sentimos, este taller ya no tiene lugares disponibles.');
        } else {
          setSubmitError(errorMsg);
        }
      }
    } catch (error) {
      console.error('Error al enviar la reserva:', error);
      setSubmitError('Error de conexión al procesar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 flex justify-center items-center h-64">
        <p className="text-gray-500">Cargando opciones...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">Agendar Nueva Cita</h1>
      <p className="text-sm text-gray-500 mb-6">Paso {step} de 4</p>

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Terapias Individuales */}
          <div>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Terapias Individuales</h2>
            {services.length === 0 ? (
              <p className="text-gray-500">No hay terapias disponibles en este momento.</p>
            ) : (
              <div className="space-y-4">
                {services.map(service => (
                  <div
                    key={service.id}
                    className="p-4 rounded-lg bg-surface border border-gray-200 hover:border-primary cursor-pointer transition-colors"
                    onClick={() => handleSelectService(service)}
                  >
                    <h3 className="font-medium text-lg">{service.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">
                        {service.duration_minutes} min
                      </span>
                      <span className="font-semibold text-primary">
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Talleres Grupales */}
          <div>
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Talleres Grupales</h2>
            {workshops.length === 0 ? (
              <p className="text-gray-500">No hay talleres disponibles en este momento.</p>
            ) : (
              <div className="space-y-4">
                {workshops.map(workshop => (
                  <div
                    key={workshop.id}
                    className="p-4 rounded-lg bg-surface border border-gray-200 hover:border-primary cursor-pointer transition-colors"
                    onClick={() => handleSelectWorkshop(workshop)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-medium text-lg">{workshop.name}</h3>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                        {workshop.type === 'online' ? 'Online' : workshop.type === 'in_person' ? 'Presencial' : workshop.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{workshop.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        {formatDateTime(workshop.starts_at)}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">
                          Cupos: {workshop.max_capacity}
                        </span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(workshop.price)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-surface rounded-lg border border-gray-200 p-6">
          {selectedType === 'workshop' && selectedItem ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Resumen del Taller</h2>
              <div className="bg-gray-50 p-4 rounded-lg inline-block text-left mb-6">
                <h3 className="font-medium text-lg">{selectedItem.name}</h3>
                <p className="text-gray-600 mt-2">
                  <span className="font-medium">Fecha y Hora:</span> {formatDateTime((selectedItem as Workshop).starts_at)}
                </p>
                <p className="text-gray-600 mt-1">
                  <span className="font-medium">Precio:</span> {formatCurrency(selectedItem.price)}
                </p>
              </div>
              <p className="text-primary font-medium mb-6">Este evento tiene una fecha y hora fijas.</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-primary text-white rounded hover:opacity-90 transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          ) : selectedType === 'service' && selectedItem ? (
            <div className="animate-fade-in">
              <h2 className="text-xl font-semibold mb-6">Selecciona tu terapeuta</h2>
              
              {isLoadingTherapists ? (
                <div className="flex justify-center items-center py-12">
                  <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : therapists.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-gray-500 mb-4">No hay terapeutas disponibles para este servicio en este momento.</p>
                  <button onClick={() => {
                    setStep(1);
                    setSelectedTherapist(null);
                    setTherapists([]);
                    setSelectedDate('');
                    setSelectedTime('');
                    setAvailableSlots([]);
                  }} className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">
                    Volver a servicios
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {therapists.map(t => (
                    <div
                      key={t.id}
                      onClick={() => { 
                        setSelectedTherapist(t); 
                        setSelectedDate(''); 
                        setSelectedTime(''); 
                        setAvailableSlots([]); 
                      }}
                      className={`p-4 rounded-xl cursor-pointer transition-all flex items-center ${
                        selectedTherapist?.id === t.id 
                          ? 'border-2 border-primary bg-primary/5' 
                          : 'border border-gray-200 hover:border-primary'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold mr-4">
                        {t.first_name[0]}{t.last_name[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{t.first_name} {t.last_name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTherapist && (
                <div className="mt-8 pt-8 border-t border-gray-200 animate-fade-in transition-opacity">
                  <h2 className="text-xl font-semibold mb-6">Selecciona una fecha</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Columna Fecha */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de tu cita
                      </label>
                      <input
                        type="date"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                        min={new Date().toISOString().split('T')[0]}
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setSelectedTime('');
                        }}
                      />
                    </div>
                    
                    {/* Columna Horarios */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Horarios Disponibles
                      </label>
                      {!selectedDate ? (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-center">
                          Selecciona una fecha primero.
                        </div>
                      ) : isLoadingSlots ? (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-center flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Buscando horarios...
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-center">
                          No hay horarios disponibles para esta fecha. Prueba con otro día.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {availableSlots.map(time => (
                            <button
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={`p-2 rounded-lg border text-center transition-colors ${
                                selectedTime === time
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-8 pt-6 border-t flex justify-between items-center">
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedTherapist(null);
                    setTherapists([]);
                    setSelectedDate('');
                    setSelectedTime('');
                    setAvailableSlots([]);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedTherapist || !selectedTime}
                  className={`px-6 py-2 rounded transition-colors ${
                    selectedTherapist && selectedTime
                      ? 'bg-primary text-white hover:opacity-90 cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Continuar a Confirmación
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {step === 3 && (
        <div className="bg-surface rounded-lg border border-gray-200 p-6 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6 text-center">Confirma tu Reserva</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium border-b pb-2 mb-4">Resumen de la Cita</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Servicio / Taller</p>
                <p className="font-medium text-lg">{selectedItem?.name}</p>
              </div>
              
              {selectedType === 'service' && selectedTherapist && (
                <div>
                  <p className="text-sm text-gray-500">Terapeuta</p>
                  <p className="font-medium">{selectedTherapist.first_name} {selectedTherapist.last_name}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-500">Fecha y Hora</p>
                <p className="font-medium">
                  {selectedType === 'service' 
                    ? formatDateTime(`${selectedDate}T${selectedTime}:00`)
                    : selectedItem && formatDateTime((selectedItem as Workshop).starts_at)}
                </p>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">Total a pagar</p>
                <p className="font-bold text-2xl text-primary">
                  {selectedItem && formatCurrency(selectedItem.price)}
                </p>
              </div>
            </div>
          </div>

          {submitSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
              {submitSuccess}
            </div>
          )}

          {submitError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
              <p className="mb-2">{submitError}</p>
              {submitError.includes('lugares disponibles') && (
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-white text-red-700 border border-red-200 rounded hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  Ver otros talleres
                </button>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-8">
            <button
              onClick={() => setStep(2)}
              disabled={isSubmitting || !!submitSuccess}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Volver
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !!submitSuccess}
              className="px-8 py-3 bg-primary text-white rounded hover:opacity-90 transition-colors font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </>
              ) : (
                'Continuar al Pago'
              )}
            </button>
          </div>
        </div>
      )}

      {step === 4 && selectedItem && createdReservationId && (
        <div className="bg-surface rounded-lg border border-gray-200 p-6 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6 text-center">Completa tu Reserva</h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Resumen de Pago</h3>
            <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-medium text-text-primary">{selectedItem.name}</p>
                <p className="text-sm text-text-secondary">
                  {paymentType === 'full' ? 'Pago completo' : paymentType === 'deposit' ? 'Anticipo' : 'Selecciona un tipo de pago'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {paymentType === 'full' 
                    ? formatCurrency(selectedItem.price) 
                    : paymentType === 'deposit' 
                      ? formatCurrency(selectedItem.deposit_amount) 
                      : '$0'}
                </p>
              </div>
            </div>
          </div>

          {Number(selectedItem.deposit_amount) > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-3">1. Selecciona cómo deseas pagar</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  onClick={() => setPaymentType('full')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentType === 'full' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-text-primary">Pago completo</span>
                    <span className="font-bold text-primary">{formatCurrency(selectedItem.price)}</span>
                  </div>
                  <p className="text-xs text-text-secondary">Tu reserva queda confirmada inmediatamente.</p>
                </div>

                <div 
                  onClick={() => setPaymentType('deposit')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentType === 'deposit' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-text-primary">Pagar anticipo</span>
                    <span className="font-bold text-primary">{formatCurrency(selectedItem.deposit_amount)}</span>
                  </div>
                  <p className="text-xs text-text-secondary">Paga el resto el día de tu cita.</p>
                </div>
              </div>
            </div>
          )}

          {paymentType && (
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-3">
                {Number(selectedItem.deposit_amount) > 0 ? "2." : "1."} Selecciona tu método de pago
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <input type="radio" name="paymentMethod" value="paypal" className="hidden" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod('paypal')} />
                  <CircleDollarSign className="text-blue-500 mr-3" size={24} />
                  <span className="font-medium text-sm">PayPal</span>
                </label>
                
                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'mercadopago' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <input type="radio" name="paymentMethod" value="mercadopago" className="hidden" checked={paymentMethod === 'mercadopago'} onChange={() => setPaymentMethod('mercadopago')} />
                  <CreditCard className="text-sky-500 mr-3" size={24} />
                  <span className="font-medium text-sm">MercadoPago</span>
                </label>

                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <input type="radio" name="paymentMethod" value="transfer" className="hidden" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} />
                  <Building2 className="text-emerald-600 mr-3" size={24} />
                  <span className="font-medium text-sm">Transferencia</span>
                </label>

                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${paymentMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <input type="radio" name="paymentMethod" value="cash" className="hidden" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} />
                  <Banknote className="text-amber-600 mr-3" size={24} />
                  <span className="font-medium text-sm">Efectivo (en cita)</span>
                </label>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {submitError}
            </div>
          )}

          {paymentMethod && paymentType && (
            <div className="mt-8 border-t pt-6">
              {paymentMethod === 'paypal' && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && (
                <div className="w-full">
                  <PayPalScriptProvider options={{ "clientId": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID, currency: "MXN" }}>
                    <PayPalButtons
                      style={{ layout: "vertical", color: "blue", shape: "rect", label: "pay" }}
                      createOrder={async () => {
                        try {
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkout/paypal/reservation-order`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${localStorage.getItem("token")}`,
                            },
                            body: JSON.stringify({
                              reservation_id: createdReservationId,
                              payment_type: paymentType
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Error al crear la orden de PayPal");
                          return data.data.paypal_order_id;
                        } catch (err) {
                          setSubmitError(err instanceof Error ? err.message : "Error con PayPal");
                          return "";
                        }
                      }}
                      onApprove={async (data) => {
                        setIsProcessingPayment(true);
                        try {
                          const amount = paymentType === 'full' ? Number(selectedItem.price) : Number(selectedItem.deposit_amount);
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkout/paypal/reservation-capture`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${localStorage.getItem("token")}`,
                            },
                            body: JSON.stringify({
                              paypal_order_id: data.orderID,
                              reservation_id: createdReservationId,
                              payment_type: paymentType,
                              amount: amount
                            }),
                          });
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error || "Error al capturar el pago");
                          
                          router.push(`/portal/reserva/pago/exitoso?reservation_id=${createdReservationId}`);
                        } catch (err) {
                          setSubmitError(err instanceof Error ? err.message : "Error al confirmar el pago");
                          setIsProcessingPayment(false);
                        }
                      }}
                    />
                  </PayPalScriptProvider>
                </div>
              )}

              {paymentMethod === 'mercadopago' && (
                <button
                  disabled={isProcessingPayment}
                  onClick={async () => {
                    setIsProcessingPayment(true);
                    setSubmitError(null);
                    try {
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkout/mp/reservation-preference`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${localStorage.getItem("token")}`,
                        },
                        body: JSON.stringify({
                          reservation_id: createdReservationId,
                          payment_type: paymentType
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Error al conectar con MercadoPago");
                      
                      window.location.href = data.data.init_point;
                    } catch (err) {
                      setSubmitError(err instanceof Error ? err.message : "No se pudo iniciar MercadoPago");
                      setIsProcessingPayment(false);
                    }
                  }}
                  className="w-full bg-[#009EE3] text-white py-3 rounded-lg font-semibold hover:bg-[#008CC9] transition-colors disabled:opacity-50"
                >
                  {isProcessingPayment ? "Redirigiendo..." : "Pagar con MercadoPago"}
                </button>
              )}

              {paymentMethod === 'transfer' && (
                <button
                  disabled={isProcessingPayment}
                  onClick={async () => {
                    setIsProcessingPayment(true);
                    try {
                      const token = localStorage.getItem('token');
                      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reservations/${createdReservationId}/status`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          status: 'pending',
                          payment_method: 'transfer',
                          payment_type: paymentType
                        })
                      });
                      const amount = paymentType === 'full' ? Number(selectedItem.price) : Number(selectedItem.deposit_amount);
                      router.push(`/portal/reserva/pago/transferencia?reservation_id=${createdReservationId}&total=${amount}`);
                    } catch (err) {
                      console.error("Error confirmando transferencia:", err);
                    } finally {
                      setIsProcessingPayment(false);
                    }
                  }}
                  className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {isProcessingPayment ? "Procesando..." : "Confirmar Reserva"}
                </button>
              )}

              {paymentMethod === 'cash' && (
                <button
                  disabled={isProcessingPayment}
                  onClick={async () => {
                    if (window.confirm("Tu reserva quedará pendiente. Preséntate el día de tu cita con el pago en efectivo. ¿Deseas continuar?")) {
                      setIsProcessingPayment(true);
                      try {
                        const token = localStorage.getItem('token');
                        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reservations/${createdReservationId}/status`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            status: 'pending',
                            payment_method: 'cash',
                            payment_type: paymentType
                          })
                        });
                        router.push('/portal/reservas');
                      } catch (err) {
                        console.error("Error confirmando efectivo:", err);
                      } finally {
                        setIsProcessingPayment(false);
                      }
                    }
                  }}
                  className="w-full border-2 border-primary text-primary py-3 rounded-lg font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {isProcessingPayment ? "Procesando..." : "Confirmar Reserva (Pago en efectivo)"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
