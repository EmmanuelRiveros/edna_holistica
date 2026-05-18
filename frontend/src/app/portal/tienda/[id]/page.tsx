"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { useCart, type CartProduct } from "@/context/CartContext";
import { ArrowLeft, Leaf, Minus, Plus, ShoppingCart, Truck, Store, Star, Loader2 } from "lucide-react";

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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  // Reviews State
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  // Form State
  const [eligibleOrders, setEligibleOrders] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false); // We'll infer this from errors or past reviews

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetchAPI(`/products/${id}`);
        setProduct(res.data.product);
      } catch { /* ignore */ }
      finally { setIsLoading(false); }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetchAPI(`/products/${id}/reviews`);
        setReviews(res.data.reviews || []);
        setAverageRating(res.data.average_rating || 0);
        setTotalReviews(res.data.total_reviews || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [id]);

  useEffect(() => {
    const fetchEligibleOrders = async () => {
      const token = localStorage.getItem("token");
      if (!token) return; // No auth

      try {
        // Fetch all orders
        const res = await fetchAPI("/orders/my-orders?limit=50", {
          headers: { Authorization: `Bearer ${token}` }
        });

        const deliveredOrders = res.data.orders.filter((o: any) => o.status === "delivered");

        // Find which delivered orders have this product
        const eligible = [];
        for (const order of deliveredOrders) {
          try {
            const detailRes = await fetchAPI(`/orders/${order.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const hasProduct = detailRes.data.items.some((item: any) => item.product_id === id);
            if (hasProduct) {
              eligible.push(order);
            }
          } catch (err) {
            console.error("Error fetching order detail", err);
          }
        }
        setEligibleOrders(eligible);
        if (eligible.length > 0) {
          setSelectedOrderId(eligible[0].id);
        }
      } catch (err) {
        console.error("Error fetching orders", err);
      }
    };

    fetchEligibleOrders();
  }, [id]);

  const handleSubmitReview = async () => {
    if (rating === 0) {
      setReviewMsg({ type: "err", text: "Por favor selecciona una calificación" });
      return;
    }
    if (!selectedOrderId) {
      setReviewMsg({ type: "err", text: "Debes seleccionar una orden" });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setIsSubmittingReview(true);
    setReviewMsg(null);

    try {
      await fetchAPI("/reviews", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: id,
          order_id: selectedOrderId,
          rating,
          comment: comment.trim() || undefined
        })
      });
      setReviewMsg({ type: "ok", text: "Tu reseña está pendiente de aprobación" });
      setHasReviewed(true);
    } catch (err) {
      setReviewMsg({ type: "err", text: err instanceof Error ? err.message : "Error al enviar reseña" });
      if (err instanceof Error && err.message.includes("Ya dejaste una reseña")) {
        setHasReviewed(true);
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    const cartProduct: CartProduct = {
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      image_urls: product.image_urls,
      allows_shipping: product.allows_shipping,
      allows_pickup: product.allows_pickup,
    };
    addItem(cartProduct, quantity);
    router.push("/portal/tienda/carrito");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted mb-4">Producto no encontrado.</p>
        <button onClick={() => router.push("/portal/tienda")} className="text-primary hover:underline text-sm">
          ← Volver al catálogo
        </button>
      </div>
    );
  }

  const maxQty = product.stock;

  return (
    <div>
      <button
        onClick={() => router.push("/portal/tienda")}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Volver al catálogo
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="bg-surface rounded-xl border border-border/50 overflow-hidden aspect-square flex items-center justify-center">
          {product.image_urls && product.image_urls.length > 0 ? (
            <img
              src={product.image_urls[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Leaf size={64} className="text-text-muted/20" />
          )}
        </div>

        {/* Info */}
        <div>
          {product.category_name && (
            <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">
              {product.category_name}
            </p>
          )}
          <h1 className="text-2xl font-bold text-text-primary mb-3">{product.name}</h1>

          <p className="text-3xl font-bold text-primary mb-4">
            ${product.price.toFixed(2)}
          </p>

          {product.description && (
            <p className="text-sm text-text-secondary leading-relaxed mb-5">
              {product.description}
            </p>
          )}

          {/* Stock */}
          <div className="mb-5">
            {product.stock === 0 ? (
              <span className="inline-block rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-medium">
                Sin stock
              </span>
            ) : product.stock <= 5 ? (
              <span className="text-sm text-red-600 font-medium">
                ¡Últimas {product.stock} unidades!
              </span>
            ) : (
              <span className="text-sm text-text-muted">
                {product.stock} disponibles
              </span>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            {product.allows_shipping && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">
                <Truck size={12} /> Envío disponible
              </span>
            )}
          </div>

          {/* Quantity + Add to cart */}
          {product.stock > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Cantidad</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-10 w-10 rounded-lg border border-border flex items-center justify-center
                               text-text-secondary hover:bg-background transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-text-primary">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    className="h-10 w-10 rounded-lg border border-border flex items-center justify-center
                               text-text-secondary hover:bg-background transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3
                           text-sm font-semibold text-white shadow-sm hover:bg-primary-dark transition-colors"
              >
                <ShoppingCart size={18} />
                Agregar al carrito — ${(product.price * quantity).toFixed(2)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REVIEWS SECTION */}
      <div className="mt-16 pt-8 border-t border-border">
        <h2 className="text-2xl font-bold text-text-primary mb-8">Reseñas de Clientes</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* A) RESUMEN DE CALIFICACIONES & FORMULARIO */}
          <div className="md:col-span-1 space-y-8">
            {/* Resumen */}
            <div className="bg-surface rounded-xl border border-border/50 p-6 text-center">
              <p className="text-5xl font-bold text-text-primary mb-2">
                {averageRating.toFixed(1)} <span className="text-3xl text-yellow-500">★</span>
              </p>
              <p className="text-sm text-text-secondary mb-4">{totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'}</p>

              <div className="space-y-2 mt-4">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = reviews.filter(r => r.rating === star).length;
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center text-sm">
                      <span className="w-8 text-text-secondary flex items-center justify-end gap-1">
                        {star} <Star size={12} className="fill-text-secondary text-text-secondary" />
                      </span>
                      <div className="flex-1 h-2 mx-3 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="w-6 text-right text-text-muted">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formulario */}
            {typeof window !== "undefined" && localStorage.getItem("token") && !hasReviewed ? (
              <div className="bg-surface rounded-xl border border-border/50 p-6">
                <h3 className="font-semibold text-text-primary mb-4">Escribe una reseña</h3>

                {eligibleOrders.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star
                            size={28}
                            className={`${star <= (hoverRating || rating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                              } transition-colors`}
                          />
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Comparte tu experiencia (opcional)..."
                      rows={3}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />

                    {eligibleOrders.length > 1 && (
                      <select
                        value={selectedOrderId}
                        onChange={e => setSelectedOrderId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {eligibleOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            Orden #{o.id.substring(0, 8).toUpperCase()} - {new Date(o.created_at).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    )}

                    {reviewMsg && (
                      <p className={`text-sm ${reviewMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                        {reviewMsg.text}
                      </p>
                    )}

                    <button
                      onClick={handleSubmitReview}
                      disabled={isSubmittingReview || rating === 0}
                      className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isSubmittingReview && <Loader2 size={16} className="animate-spin" />}
                      Publicar Reseña
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary text-center italic">
                    Compra este producto y recíbelo para poder dejar una reseña.
                  </p>
                )}
              </div>
            ) : hasReviewed ? (
              <div className="bg-surface rounded-xl border border-border/50 p-6 text-center">
                <p className="text-sm text-green-600 font-medium">¡Gracias por tu reseña!</p>
              </div>
            ) : null}
          </div>

          {/* C) LISTA DE RESEÑAS */}
          <div className="md:col-span-2 space-y-4">
            {isLoadingReviews ? (
              <div className="flex justify-center py-10">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : reviews.length > 0 ? (
              <>
                {reviews.map(review => (
                  <div key={review.id} className="bg-surface rounded-xl border border-border/50 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {review.first_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            {review.first_name} {review.last_name?.[0]}.
                          </p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star
                                key={star}
                                size={12}
                                className={star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-text-muted">
                        {new Date(review.created_at).toLocaleDateString("es-MX", { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-text-secondary mt-3">{review.comment}</p>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="bg-surface rounded-xl border border-border/50 border-dashed p-10 text-center">
                <Star size={32} className="mx-auto text-text-muted/30 mb-3" />
                <p className="text-text-primary font-medium">No hay reseñas todavía</p>
                <p className="text-sm text-text-secondary">Sé el primero en reseñar este producto.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
