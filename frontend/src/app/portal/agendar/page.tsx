"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
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
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);

  // Estados para la Fase 3
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

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
    if (step === 2 && selectedType === 'service' && selectedDate) {
      setIsLoadingSlots(true);
      
      // TODO: Reemplazar este mock con el endpoint real en el futuro:
      // GET /api/v1/availability?service_id=${selectedItem?.id}&date=${selectedDate}
      
      // MOCK TEMPORAL:
      const timeoutId = setTimeout(() => {
        setAvailableSlots(['10:00', '12:30', '15:00', '17:00', '18:30']);
        setIsLoadingSlots(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedDate, step, selectedType, selectedItem]);

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
        setSubmitSuccess('Reserva confirmada exitosamente. Redirigiendo...');
        setTimeout(() => {
          router.push('/portal/reservas');
        }, 2000);
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
      <p className="text-sm text-gray-500 mb-6">Paso {step} de 3</p>

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
            <div>
              <h2 className="text-xl font-semibold mb-6">Selecciona Fecha y Hora</h2>
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
                      No hay horarios disponibles para esta fecha.
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
              
              <div className="mt-8 pt-6 border-t flex justify-between items-center">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedTime}
                  className={`px-6 py-2 rounded transition-colors ${
                    selectedTime
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
                'Confirmar y Agendar'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
