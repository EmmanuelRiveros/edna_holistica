"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { useCart, type CartProduct } from "@/context/CartContext";
import { Search, ShoppingCart, Leaf, Plus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_urls: string[] | null;
  is_active: boolean;
  allows_shipping: boolean;
  allows_pickup: boolean;
  category_id: string | null;
  category_name: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function TiendaPortalPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProducts = useCallback(async (q = "", catId = "") => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (q) params.set("search", q);
      if (catId) params.set("category_id", catId);
      const res = await fetchAPI(`/products?${params.toString()}`);
      setProducts(res.data.products);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetchAPI("/categories");
      setCategories(res.data.categories);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsLoading(true);
      fetchProducts(val, activeCategory);
    }, 400);
  };

  const handleCategoryFilter = (catId: string) => {
    setActiveCategory(catId);
    setIsLoading(true);
    fetchProducts(search, catId);
  };

  const handleAddToCart = (p: Product) => {
    const cartProduct: CartProduct = {
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      image_urls: p.image_urls,
      allows_shipping: p.allows_shipping,
      allows_pickup: p.allows_pickup,
    };
    addItem(cartProduct);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">Cargando tienda...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Tienda Holística</h1>
        <p className="text-sm text-text-secondary mt-1">
          Descubre nuestros productos naturales
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar productos..."
          className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm
                     text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => handleCategoryFilter("")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === ""
              ? "bg-primary text-white"
              : "bg-surface border border-border text-text-secondary hover:bg-background"
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => handleCategoryFilter(c.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === c.id
                ? "bg-primary text-white"
                : "bg-surface border border-border text-text-secondary hover:bg-background"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <Leaf size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No se encontraron productos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-surface rounded-xl border border-border/50 shadow-sm overflow-hidden
                         hover:shadow-md transition-shadow cursor-pointer group"
            >
              {/* Image */}
              <div
                onClick={() => router.push(`/portal/tienda/${p.id}`)}
                className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden"
              >
                {p.image_urls && p.image_urls.length > 0 ? (
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Leaf size={32} className="text-text-muted/30" />
                )}
                {p.stock === 0 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Sin stock
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p
                  onClick={() => router.push(`/portal/tienda/${p.id}`)}
                  className="font-medium text-text-primary text-sm line-clamp-2 mb-1 hover:text-primary transition-colors"
                >
                  {p.name}
                </p>
                <p className="text-lg font-bold text-primary mb-2">
                  ${p.price.toFixed(2)}
                </p>

                {p.stock > 0 && p.stock <= 5 && (
                  <p className="text-xs text-red-600 font-medium mb-2">
                    ¡Últimas {p.stock} unidades!
                  </p>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); handleAddToCart(p); }}
                  disabled={p.stock === 0}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2
                             text-sm font-medium text-white hover:bg-primary-dark transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  Agregar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
