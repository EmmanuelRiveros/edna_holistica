"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAPI } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import {
  Minus, Plus, Trash2, ShoppingBag, Leaf, Loader2,
  Tag, CheckCircle2, AlertCircle, MapPin, PlusCircle, Building, X
} from "lucide-react";

export default function CarritoPage() {
  const router = useRouter();
  const {
    items, couponCode, discount, total, totalWithDiscount, itemCount,
    updateQuantity, removeItem, clearCart, applyCoupon,
  } = useCart();

  // ── States ──────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [notes, setNotes] = useState("");

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [tempSelectedAddressId, setTempSelectedAddressId] = useState<string | null>(null);

  const [isNewAddressModalOpen, setIsNewAddressModalOpen] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    recipient_name: "", street: "", neighborhood: "", postal_code: "",
    city: "", state: "", references: "", contact_phone: "",
    save_for_future: false, alias: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "mercadopago" | "transfer" | null>(null);
  const [transferSettings, setTransferSettings] = useState<any | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const SHIPPING_COST = 199.99;
  const FINAL_TOTAL = totalWithDiscount + SHIPPING_COST;

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return { Authorization: "Bearer " + token };
  }, []);

  // ── Fetch Initial Data ──────────────────────────────────────
  useEffect(() => {
    const fetchInitial = async () => {
      const headers = getHeaders();
      if (headers) {
        try {
          const resAddresses = await fetchAPI("/addresses", { headers });
          const addrs = resAddresses.data.addresses || [];
          setAddresses(addrs);
          if (addrs.length > 0) {
            const defaultAddr = addrs.find((a: any) => a.is_default) || addrs[0];
            setSelectedAddress(defaultAddr);
          }
        } catch (e) { /* ignore */ }
      }

      try {
        const resSettings = await fetchAPI("/payment-settings", { headers: getHeaders() || {} });
        setTransferSettings(resSettings.data.settings || null);
      } catch (e) { /* ignore */ }
    };
    fetchInitial();
  }, [getHeaders]);

  // ── Coupon Validation ───────────────────────────────────────
  const handleValidateCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponMsg(null);

    try {
      const res = await fetchAPI(
        `/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&total=${total}`
      );
      applyCoupon(couponInput.trim().toUpperCase(), res.data.discount_amount);
      setCouponMsg({
        type: "ok",
        text: `¡Cupón aplicado! Descuento: $${res.data.discount_amount.toFixed(2)}`,
      });
    } catch (err) {
      applyCoupon("", 0);
      setCouponMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Cupón no válido",
      });
    } finally {
      setValidatingCoupon(false);
    }
  };

  // ── Address Handlers ────────────────────────────────────────
  const handleSaveNewAddress = async () => {
    if (!newAddressForm.recipient_name || !newAddressForm.street || !newAddressForm.city || !newAddressForm.state) {
      return alert("Completa los campos obligatorios (*)");
    }

    const newAddrObj = { ...newAddressForm };
    
    if (newAddressForm.save_for_future) {
      const headers = getHeaders();
      if (!headers) {
        return alert("Debes iniciar sesión para guardar direcciones");
      }
      setIsProcessing(true);
      try {
        const res = await fetchAPI("/addresses", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...newAddressForm,
            is_default: true,
          })
        });
        const savedAddr = res.data.address;
        setAddresses([savedAddr, ...addresses.map(a => ({...a, is_default: false}))]);
        setSelectedAddress(savedAddr);
        setIsNewAddressModalOpen(false);
        setNewAddressForm({
          recipient_name: "", street: "", neighborhood: "", postal_code: "",
          city: "", state: "", references: "", contact_phone: "",
          save_for_future: false, alias: "",
        });
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al guardar dirección");
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Usar temporalmente sin guardar
      setSelectedAddress({ ...newAddrObj, id: "temp-" + Date.now() });
      setIsNewAddressModalOpen(false);
    }
  };

  // ── Order Creation Helper ───────────────────────────────────
  const createOrderRecord = async () => {
    const headers = getHeaders();
    if (!headers) {
      alert("Debes iniciar sesión para comprar");
      throw new Error("No auth");
    }

    // Construir shipping_address combinado para el backend
    const shippingStr = `${selectedAddress.recipient_name} - ${selectedAddress.street}, ${selectedAddress.neighborhood || ''}, ${selectedAddress.city}, ${selectedAddress.state} CP ${selectedAddress.postal_code || ''}. Tel: ${selectedAddress.contact_phone || ''}. Ref: ${selectedAddress.references || 'N/A'}`;

    const body = {
      items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      delivery_type: "shipping",
      shipping_address: shippingStr,
      coupon_code: couponCode || undefined,
      notes: notes || undefined,
      // Extra fields as requested (even if backend ignores them, they are in the spec)
      recipient_name: selectedAddress.recipient_name,
      street: selectedAddress.street,
      neighborhood: selectedAddress.neighborhood,
      postal_code: selectedAddress.postal_code,
      city: selectedAddress.city,
      state: selectedAddress.state,
      references: selectedAddress.references,
      contact_phone: selectedAddress.contact_phone,
    };

    const res = await fetchAPI("/orders", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return res.data.order;
  };

  // ── Checkout Methods ────────────────────────────────────────
  const handleTransferCheckout = async () => {
    setIsProcessing(true);
    try {
      const order = await createOrderRecord();
      
      // Guardar info en localStorage y redirigir
      localStorage.setItem("pending_transfer", JSON.stringify({
        total: FINAL_TOTAL,
        order_id: order.id
      }));

      clearCart();
      router.push(`/portal/pago/transferencia?total=${FINAL_TOTAL}&order_id=${order.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error creando la orden");
      setIsProcessing(false);
    }
  };

  const handlePayPalCheckout = async () => {
    setIsProcessing(true);
    try {
      const order = await createOrderRecord();
      const res = await fetchAPI("/checkout/paypal", {
        method: "POST",
        headers: getHeaders()!,
        body: JSON.stringify({ order_id: order.id }),
      });
      window.location.href = res.data.init_point || res.data.approve_link || res.data.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error iniciando PayPal");
      setIsProcessing(false);
    }
  };

  const handleMercadoPagoCheckout = async () => {
    setIsProcessing(true);
    try {
      const order = await createOrderRecord();
      const res = await fetchAPI("/checkout/mp/preference", {
        method: "POST",
        headers: getHeaders()!,
        body: JSON.stringify({ order_id: order.id }),
      });
      window.location.href = res.data.init_point;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error procesando con MercadoPago");
      setIsProcessing(false);
    }
  };

  const canProceed = items.length > 0 && selectedAddress && paymentMethod;

  // ── Empty State ─────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag size={48} className="text-text-muted/30 mb-4" />
        <h2 className="text-lg font-bold text-text-primary mb-2">Tu carrito está vacío</h2>
        <p className="text-sm text-text-secondary mb-6">Agrega productos desde nuestra tienda</p>
        <button
          onClick={() => router.push("/portal/tienda")}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          Ir a la tienda
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ==============================================================
            COLUMNA IZQUIERDA (2/3)
            ============================================================== */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BLOQUE 1: Lista de Productos */}
          <div className="bg-surface rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-background/50">
              <h2 className="font-semibold text-text-primary">Tu Carrito ({itemCount} items)</h2>
            </div>
            <div className="divide-y divide-border/50">
              {items.map((item) => (
                <div key={item.product.id} className="p-5 flex items-start sm:items-center gap-4 relative">
                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="absolute top-4 right-4 p-1.5 text-text-muted hover:text-danger hover:bg-danger-light rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 border border-border/50">
                    {item.product.image_urls && item.product.image_urls.length > 0 ? (
                      <img src={item.product.image_urls[0]} alt={item.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Leaf size={24} className="text-text-muted/30" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-8">
                    <p className="font-medium text-text-primary text-sm sm:text-base mb-1 truncate">{item.product.name}</p>
                    <p className="text-xs text-text-secondary">${item.product.price.toFixed(2)} unitario</p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="h-7 w-7 rounded border border-border flex items-center justify-center text-text-secondary hover:bg-background transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-text-primary">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, Math.min(item.quantity + 1, item.product.stock))}
                          disabled={item.quantity >= item.product.stock}
                          className="h-7 w-7 rounded border border-border flex items-center justify-center text-text-secondary hover:bg-background transition-colors disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="font-bold text-text-primary text-sm sm:text-base">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cupón (movido a la columna izquierda) */}
            <div className="px-5 py-4 bg-background/30 border-t border-border/50">
              <label className="flex items-center gap-1.5 text-sm font-medium text-text-primary mb-3">
                <Tag size={16} /> Cupón de descuento
              </label>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={handleValidateCoupon}
                  disabled={validatingCoupon || !couponInput.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  {validatingCoupon ? <Loader2 size={16} className="animate-spin" /> : "Aplicar"}
                </button>
              </div>
              {couponMsg && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${couponMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {couponMsg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {couponMsg.text}
                </div>
              )}
            </div>
          </div>

          {/* BLOQUE 2: Notas */}
          <div className="bg-surface rounded-xl border border-border/50 shadow-sm p-5">
            <h2 className="font-semibold text-text-primary mb-3">Indicaciones especiales</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones de entrega, referencias de tu domicilio, a quién entregarle..."
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>


        {/* ==============================================================
            COLUMNA DERECHA (1/3)
            ============================================================== */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* BLOQUE 2: Dirección (El Cupón fue movido a la izquierda) */}
          <div className="bg-surface rounded-xl border border-border/50 shadow-sm p-5">
            <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-primary" /> Dirección de Envío
            </h2>
            
            {selectedAddress ? (
              <div className="space-y-3">
                <div className="bg-background rounded-lg p-3 border border-border/50 text-sm">
                  <p className="font-semibold text-text-primary mb-0.5">{selectedAddress.recipient_name}</p>
                  <p className="text-text-secondary leading-relaxed">
                    {selectedAddress.street}, {selectedAddress.neighborhood && `${selectedAddress.neighborhood}, `}
                    {selectedAddress.city}, {selectedAddress.state} {selectedAddress.postal_code}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddressModalOpen(true)}
                  className="w-full text-sm font-medium text-primary hover:underline"
                >
                  Cambiar dirección
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsNewAddressModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 p-4 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <PlusCircle size={18} /> Agregar dirección de envío
              </button>
            )}
            
            {!selectedAddress && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle size={12} /> Agrega una dirección de envío
              </p>
            )}
          </div>

          {/* BLOQUE 3: Método de Pago */}
          <div className="bg-surface rounded-xl border border-border/50 shadow-sm p-5">
            <h2 className="font-semibold text-text-primary mb-4">Método de Pago</h2>
            
            <div className="space-y-3">
              {/* PayPal */}
              <label className={`block border rounded-lg p-3 cursor-pointer transition-colors ${paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="payment" value="paypal" checked={paymentMethod === 'paypal'} onChange={() => setPaymentMethod("paypal")} className="text-primary focus:ring-primary" />
                  <span className="font-bold text-blue-900 italic">Pay<span className="text-blue-400">Pal</span></span>
                </div>
              </label>

              {/* MercadoPago */}
              <label className={`block border rounded-lg p-3 cursor-pointer transition-colors ${paymentMethod === 'mercadopago' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="payment" value="mercadopago" checked={paymentMethod === 'mercadopago'} onChange={() => setPaymentMethod("mercadopago")} className="text-primary focus:ring-primary" />
                  <span className="font-bold text-blue-500">mercado<span className="font-normal text-blue-800">pago</span></span>
                </div>
              </label>

              {/* Transfer */}
              <label className={`block border rounded-lg p-3 cursor-pointer transition-colors ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5' : 'border-border hover:bg-background'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="payment" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod("transfer")} className="text-primary focus:ring-primary" />
                  <div className="flex items-center gap-2 font-medium text-text-primary">
                    <Building size={16} /> Transferencia Bancaria
                  </div>
                </div>
              </label>
            </div>

            {!paymentMethod && (
              <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
                <AlertCircle size={12} /> Selecciona un método de pago
              </p>
            )}
          </div>

          {/* BLOQUE 4: Resumen */}
          <div className="bg-surface rounded-xl border border-border/50 shadow-sm p-5">
            <h2 className="font-semibold text-text-primary mb-4">Resumen de Compra</h2>
            <div className="space-y-2 text-sm text-text-secondary mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento cupón</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Costo de envío</span>
                <span>${SHIPPING_COST.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="font-semibold text-text-primary">Total</span>
              <span className="text-2xl font-bold text-primary">${FINAL_TOTAL.toFixed(2)}</span>
            </div>
          </div>

          {/* BLOQUE 5: Acción Final */}
          <div className="pt-2">
            {!canProceed ? (
              <button disabled className="w-full rounded-lg bg-gray-200 text-gray-500 py-3 font-semibold cursor-not-allowed text-sm">
                Completa tus datos para pagar
              </button>
            ) : (
              <>
                {paymentMethod === 'transfer' && (
                  <button
                    onClick={handleTransferCheckout}
                    disabled={isProcessing}
                    className="w-full rounded-lg bg-orange-600 py-3 font-semibold text-white hover:bg-orange-700 transition-colors flex justify-center items-center gap-2 shadow-sm text-sm"
                  >
                    {isProcessing && <Loader2 size={16} className="animate-spin" />}
                    Confirmar Pedido (Transferencia)
                  </button>
                )}

                {paymentMethod === 'mercadopago' && (
                  <button
                    onClick={handleMercadoPagoCheckout}
                    disabled={isProcessing}
                    className="w-full rounded-lg bg-[#009ee3] py-3 font-semibold text-white hover:bg-[#008bcb] transition-colors flex justify-center items-center gap-2 shadow-sm text-sm"
                  >
                    {isProcessing && <Loader2 size={16} className="animate-spin" />}
                    Pagar con MercadoPago
                  </button>
                )}

                {paymentMethod === 'paypal' && (
                  <button
                    onClick={handlePayPalCheckout}
                    disabled={isProcessing}
                    className="w-full rounded-lg bg-[#003087] py-3 font-semibold text-white hover:bg-[#001c56] transition-colors flex justify-center items-center gap-2 shadow-sm text-sm"
                  >
                    {isProcessing && <Loader2 size={16} className="animate-spin" />}
                    Pagar con PayPal
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ==============================================================
          MODALES
          ============================================================== */}
          
      {/* Modal: Seleccionar Dirección */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">Mis Direcciones</h3>
              <button onClick={() => setIsAddressModalOpen(false)} className="text-text-muted hover:bg-background p-1.5 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3 mb-6">
              {addresses.map(addr => (
                <div
                  key={addr.id}
                  onClick={() => setTempSelectedAddressId(addr.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    (tempSelectedAddressId || selectedAddress?.id) === addr.id 
                      ? 'border-primary ring-1 ring-primary/20 bg-primary/5' 
                      : 'border-border hover:border-text-muted'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-text-primary">{addr.alias || 'Dirección'}</p>
                    {addr.is_default && <span className="text-[10px] uppercase font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Default</span>}
                  </div>
                  <p className="text-sm font-medium text-text-secondary">{addr.recipient_name}</p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {addr.street}, {addr.neighborhood && `${addr.neighborhood}, `}
                    {addr.city}, {addr.state} {addr.postal_code}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setIsAddressModalOpen(false); setIsNewAddressModalOpen(true); }}
              className="w-full flex items-center justify-center gap-2 text-primary font-medium text-sm py-3 border border-dashed border-primary/40 rounded-lg hover:bg-primary/5 mb-4"
            >
              <PlusCircle size={16} /> Agregar nueva dirección
            </button>

            <div className="flex gap-3">
              <button onClick={() => setIsAddressModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-background">
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const sel = addresses.find(a => a.id === (tempSelectedAddressId || selectedAddress?.id));
                  if (sel) setSelectedAddress(sel);
                  setIsAddressModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark"
              >
                Usar esta dirección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Dirección */}
      {isNewAddressModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text-primary mb-4">Nueva Dirección de Envío</h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Nombre del destinatario *</label>
                <input type="text" value={newAddressForm.recipient_name} onChange={e => setNewAddressForm({...newAddressForm, recipient_name: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Calle y Número *</label>
                  <input type="text" value={newAddressForm.street} onChange={e => setNewAddressForm({...newAddressForm, street: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Colonia</label>
                  <input type="text" value={newAddressForm.neighborhood} onChange={e => setNewAddressForm({...newAddressForm, neighborhood: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Ciudad *</label>
                  <input type="text" value={newAddressForm.city} onChange={e => setNewAddressForm({...newAddressForm, city: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Estado *</label>
                  <input type="text" value={newAddressForm.state} onChange={e => setNewAddressForm({...newAddressForm, state: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Código Postal</label>
                  <input type="text" value={newAddressForm.postal_code} onChange={e => setNewAddressForm({...newAddressForm, postal_code: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Teléfono</label>
                  <input type="text" value={newAddressForm.contact_phone} onChange={e => setNewAddressForm({...newAddressForm, contact_phone: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-medium mb-1">Referencias</label>
                <textarea rows={2} value={newAddressForm.references} onChange={e => setNewAddressForm({...newAddressForm, references: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none resize-none" />
              </div>
              
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-text-primary">
                  <input type="checkbox" checked={newAddressForm.save_for_future} onChange={e => setNewAddressForm({...newAddressForm, save_for_future: e.target.checked})} className="rounded text-primary focus:ring-primary" />
                  Guardar dirección para futuras compras
                </label>
              </div>

              {newAddressForm.save_for_future && (
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Alias (Ej. Casa, Trabajo)</label>
                  <input type="text" value={newAddressForm.alias} onChange={e => setNewAddressForm({...newAddressForm, alias: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none" />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsNewAddressModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-background">
                Cancelar
              </button>
              <button 
                onClick={handleSaveNewAddress}
                disabled={isProcessing}
                className="flex-[2] py-2.5 flex items-center justify-center gap-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-60"
              >
                {isProcessing && <Loader2 size={16} className="animate-spin" />}
                Guardar y usar esta dirección
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
