"use client";

import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

export default function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Sparkles className="text-primary h-6 w-6" />
            <span className="font-bold text-xl text-primary tracking-tight">
              Edna Lugo Holística
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#servicios" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">Servicios</Link>
            <Link href="#talleres" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">Talleres</Link>
            <Link href="#tienda" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">Tienda</Link>
            <Link href="#nosotros" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">Nosotros</Link>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login" className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-full hover:border-primary hover:text-primary transition-all text-sm font-medium">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="px-6 py-2.5 bg-primary text-white rounded-full hover:bg-orange-600 transition-all text-sm font-medium shadow-sm hover:shadow-md">
              Registrarse
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-primary p-2"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 pt-2 pb-6 space-y-1">
            <Link onClick={() => setIsMenuOpen(false)} href="#servicios" className="block px-3 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg">Servicios</Link>
            <Link onClick={() => setIsMenuOpen(false)} href="#talleres" className="block px-3 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg">Talleres</Link>
            <Link onClick={() => setIsMenuOpen(false)} href="#tienda" className="block px-3 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg">Tienda</Link>
            <Link onClick={() => setIsMenuOpen(false)} href="#nosotros" className="block px-3 py-3 text-base font-medium text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg">Nosotros</Link>
            <div className="pt-4 flex flex-col gap-3">
              <Link onClick={() => setIsMenuOpen(false)} href="/login" className="w-full text-center px-5 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium">Iniciar sesión</Link>
              <Link onClick={() => setIsMenuOpen(false)} href="/registro" className="w-full text-center px-5 py-3 bg-primary text-white rounded-xl font-medium">Registrarse</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
