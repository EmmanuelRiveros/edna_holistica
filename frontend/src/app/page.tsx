"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart, Leaf, Sun, Star, Sparkles,
  Hand, Zap, Users, Coffee, Brain,
  ShoppingBag,
} from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

// --- Types ---
interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: string;
}

interface Workshop {
  id: string;
  name: string;
  description: string;
  type: string;
  starts_at: string;
  max_capacity: number;
  price: string;
}

interface Product {
  id: string;
  name: string;
  price: string;
}

// --- Helpers ---
const formatCurrency = (amount: string | number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0
  }).format(Number(amount));
};

const getServiceIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('samma') || lower.includes('masaje')) return <Hand className="w-6 h-6" />;
  if (lower.includes('barras')) return <Zap className="w-6 h-6" />;
  if (lower.includes('constelaciones')) return <Users className="w-6 h-6" />;
  if (lower.includes('cacao') || lower.includes('ceremonia')) return <Coffee className="w-6 h-6" />;
  if (lower.includes('meditación') || lower.includes('meditacion')) return <Brain className="w-6 h-6" />;
  return <Sparkles className="w-6 h-6" />;
};

export default function LandingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    const fetchPublicData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        const [servicesRes, workshopsRes, productsRes] = await Promise.allSettled([
          fetch(`${apiUrl}/services`),
          fetch(`${apiUrl}/workshops?status=published`),
          fetch(`${apiUrl}/products`)
        ]);

        if (servicesRes.status === 'fulfilled' && servicesRes.value.ok) {
          const data = await servicesRes.value.json();
          const list = data.data?.services || data.services || [];
          setServices(list.filter((s: any) => s.is_active).slice(0, 6));
        }

        if (workshopsRes.status === 'fulfilled' && workshopsRes.value.ok) {
          const data = await workshopsRes.value.json();
          const list = data.data?.workshops || data.workshops || [];
          const now = new Date();
          const upcoming = list
            .filter((w: any) => new Date(w.starts_at) > now)
            .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
            .slice(0, 3);
          setWorkshops(upcoming);
        }

        if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
          const data = await productsRes.value.json();
          const list = data.data?.products || data.products || [];
          setProducts(list.filter((p: any) => p.is_active).slice(0, 4));
        }
      } catch (error) {
        console.error("Error fetching public data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicData();

    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <PublicNavbar />

      {/* --- SECCIÓN 1: HERO --- */}
      <section className="relative min-h-[calc(100vh-80px)] flex items-center bg-gradient-to-b from-orange-50 to-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-0 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Columna Izquierda */}
            <div className="flex flex-col items-start space-y-6 z-10">
              <div className="bg-orange-100 text-primary px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Sanación Holística en Guaymas
              </div>
              <h1 className="text-5xl md:text-6xl font-light leading-tight">
                Reconecta con <br />
                <span className="text-primary font-bold">tu bienestar</span> <br />
                interior
              </h1>
              <p className="text-xl text-gray-500 font-light max-w-md leading-relaxed">
                Servicios terapéuticos personalizados para restaurar el equilibrio de tu cuerpo, mente y espíritu.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-4">
                <Link href="/login" className="px-8 py-4 bg-primary text-white rounded-full text-lg text-center hover:bg-primary-dark transition-all shadow-md hover:shadow-lg font-medium">
                  Agendar mi cita
                </Link>
                <Link href="#servicios" className="px-8 py-4 border-2 border-primary text-primary rounded-full text-lg text-center hover:bg-orange-50 transition-all font-medium">
                  Explorar servicios
                </Link>
              </div>

              <div className="flex flex-wrap gap-4 pt-8 text-sm text-gray-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="text-primary">✓</span> +500 sesiones realizadas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-primary">✓</span> Terapeutas certificados
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-primary">✓</span> Ambiente seguro
                </span>
              </div>
            </div>

            {/* Columna Derecha (Visual) */}
            <div className="relative h-[400px] md:h-[500px] flex items-center justify-center lg:justify-end z-0">
              <div className="relative w-72 h-72 md:w-[400px] md:h-[400px] bg-orange-100 rounded-full flex items-center justify-center animate-pulse-slow">

                {/* Íconos Flotantes */}
                <Heart className="absolute top-10 right-10 text-primary/40 w-10 h-10 animate-float" style={{ animationDelay: '0s' }} />
                <Leaf className="absolute bottom-20 left-4 text-green-500/40 w-12 h-12 animate-float" style={{ animationDelay: '1s' }} />
                <Sun className="absolute top-20 left-10 text-yellow-500/40 w-14 h-14 animate-float" style={{ animationDelay: '2s' }} />
                <Star className="absolute bottom-10 right-20 text-orange-400/40 w-8 h-8 animate-float" style={{ animationDelay: '3s' }} />

                <div className="text-center">
                  <h2 className="text-3xl md:text-5xl font-serif text-primary tracking-wider opacity-80">
                    Edna Lugo
                  </h2>
                  <p className="text-xl md:text-2xl font-light text-gray-500 tracking-widest mt-2">
                    HOLÍSTICA
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- SECCIÓN 2: SERVICIOS --- */}
      <section id="servicios" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Nuestros Servicios</span>
            <h2 className="text-4xl font-light mt-2 mb-4">Terapias que transforman</h2>
            <p className="text-gray-500 text-lg font-light">Cada sesión es un viaje hacia tu mejor versión</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              No hay servicios disponibles en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map(service => (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md border border-gray-100 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full"
                >
                  <div className="bg-orange-100 w-14 h-14 rounded-xl flex items-center justify-center text-primary mb-6">
                    {getServiceIcon(service.name)}
                  </div>
                  <h3 className="text-xl font-medium mb-3">{service.name}</h3>
                  <p className="text-gray-500 text-sm line-clamp-3 mb-6 flex-grow">
                    {service.description}
                  </p>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <span className="text-sm font-medium text-gray-500">
                      ⏱ {service.duration_minutes} min
                    </span>
                    <span className="text-lg font-semibold text-primary">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-16 text-center">
            <Link href="/login" className="inline-flex items-center justify-center px-8 py-4 border-2 border-primary text-primary rounded-full hover:bg-orange-50 transition-colors font-medium">
              Ver todos los servicios <span className="ml-2">→</span> Agendar
            </Link>
          </div>
        </div>
      </section>

      {/* --- SECCIÓN 3: TALLERES --- */}
      <section id="talleres" className="py-24 bg-orange-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-16">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Próximos Eventos</span>
            <h2 className="text-4xl font-light mt-2 mb-4">Talleres grupales</h2>
            <p className="text-gray-500 text-lg font-light">Experiencias colectivas de sanación</p>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2].map(i => (
                <div key={i} className="h-32 bg-white/50 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : workshops.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100">
              <Leaf className="w-12 h-12 text-green-400 mx-auto mb-4 opacity-50" />
              <p className="text-gray-600 font-light text-lg">Próximamente nuevos talleres.</p>
              <p className="text-gray-500 text-sm mt-2">Regístrate para ser el primero en enterarte.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {workshops.map(workshop => {
                const date = new Date(workshop.starts_at);
                const day = date.getDate();
                const month = date.toLocaleString('es-MX', { month: 'short' });

                const typeStyle = workshop.type === 'presencial'
                  ? 'bg-green-100 text-green-700'
                  : workshop.type === 'virtual'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700';

                return (
                  <div key={workshop.id} className="bg-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow border border-gray-100">

                    {/* Fecha destacada */}
                    <div className="bg-primary text-white rounded-xl p-4 flex flex-col items-center justify-center min-w-[100px] shrink-0">
                      <span className="text-3xl font-bold leading-none">{day}</span>
                      <span className="text-sm uppercase font-medium mt-1 tracking-wider">{month}</span>
                    </div>

                    {/* Contenido */}
                    <div className="flex-grow flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyle} uppercase tracking-wider`}>
                          {workshop.type}
                        </span>
                      </div>
                      <h3 className="text-xl font-medium mb-2">{workshop.name}</h3>
                      <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                        {workshop.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-4 mt-auto pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
                          <span>👥 {workshop.max_capacity} lugares</span>
                          <span className="text-primary font-bold text-lg">{formatCurrency(workshop.price)}</span>
                        </div>
                        <Link href="/login" className="px-6 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-dark transition-colors">
                          Reservar lugar
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* --- SECCIÓN 4: TIENDA --- */}
      <section id="tienda" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">Tienda Holística</span>
              <h2 className="text-4xl font-light mt-2 mb-2">Lleva la sanación a tu hogar</h2>
              <p className="text-gray-500 text-lg font-light">Productos naturales seleccionados para tu bienestar</p>
            </div>
            <Link href="/login" className="hidden md:inline-flex items-center text-primary font-medium hover:text-orange-600 transition-colors">
              Visitar tienda completa <span className="ml-2">→</span>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-gray-500 p-8 border border-gray-100 rounded-2xl">
              Pronto encontrarás productos increíbles aquí.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {products.map(product => (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 group">
                  <div className="h-48 bg-orange-50 flex items-center justify-center relative overflow-hidden">
                    <ShoppingBag className="w-12 h-12 text-primary/30 group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="p-5 flex flex-col">
                    <h3 className="font-medium text-sm text-gray-800 line-clamp-2 mb-2 h-10">{product.name}</h3>
                    <p className="text-primary font-bold text-lg mb-4">{formatCurrency(product.price)}</p>
                    <Link href="/login" className="text-xs text-primary font-medium uppercase tracking-wider group-hover:underline">
                      Ver producto →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <Link href="/login" className="inline-flex items-center text-primary font-medium hover:text-orange-600 transition-colors">
              Visitar tienda completa <span className="ml-2">→</span>
            </Link>
          </div>

        </div>
      </section>

      {/* --- SECCIÓN 5: CTA FINAL --- */}
      <section className="py-24 bg-gradient-to-r from-orange-500 to-orange-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-light text-white mb-6">Comienza tu viaje de sanación hoy</h2>
          <p className="text-xl text-white/90 font-light mb-10 max-w-2xl mx-auto">
            Tu bienestar merece atención profesional y un espacio dedicado a tu paz interior.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/registro" className="px-8 py-4 bg-white text-primary rounded-full font-medium text-lg hover:bg-gray-50 transition-colors shadow-sm">
              Crear mi cuenta
            </Link>
            <Link href="/login" className="px-8 py-4 border-2 border-white text-white rounded-full font-medium text-lg hover:bg-white/10 transition-colors">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* --- SECCIÓN 6: FOOTER --- */}
      <footer className="bg-gray-900 text-gray-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12 border-b border-gray-800 pb-12">

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-primary h-5 w-5" />
                <span className="font-bold text-lg text-white tracking-tight">Edna Lugo Holística</span>
              </div>
              <p className="text-sm text-gray-400 font-light max-w-xs leading-relaxed">
                Acompañamiento profesional y amoroso en tu camino hacia la sanación integral.
              </p>
            </div>

            <div>
              <h4 className="text-white font-medium mb-4 uppercase tracking-wider text-sm">Enlaces rápidos</h4>
              <ul className="space-y-3 text-sm font-light">
                <li><Link href="#servicios" className="hover:text-primary transition-colors">Servicios</Link></li>
                <li><Link href="#talleres" className="hover:text-primary transition-colors">Talleres</Link></li>
                <li><Link href="#tienda" className="hover:text-primary transition-colors">Tienda</Link></li>
                <li><Link href="/login" className="hover:text-primary transition-colors">Portal de clientes</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-medium mb-4 uppercase tracking-wider text-sm">Conecta</h4>
              <a href="https://instagram.com/ednalugoholistica" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group w-fit">
                <div className="bg-gray-800 p-2 rounded-full group-hover:bg-primary transition-colors">

                </div>
                <span className="font-light text-sm">@ednalugoholistica</span>
              </a>
            </div>

          </div>

          <div className="text-center text-xs text-gray-500 font-light tracking-wide">
            © {new Date().getFullYear()} Edna Lugo Holística. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
