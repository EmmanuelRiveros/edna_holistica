"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";

// ── Types ───────────────────────────────────────────────────
export interface CartProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_urls: string[] | null;
  allows_shipping: boolean;
  allows_pickup: boolean;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  couponCode: string;
  discount: number; // absolute amount
}

type CartAction =
  | { type: "ADD_ITEM"; product: CartProduct; quantity: number }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "UPDATE_QUANTITY"; productId: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "APPLY_COUPON"; code: string; discount: number }
  | { type: "HYDRATE"; state: CartState };

interface CartContextValue extends CartState {
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  total: number;
  totalWithDiscount: number;
  itemCount: number;
}

// ── Reducer ─────────────────────────────────────────────────
const STORAGE_KEY = "cart";

const initialState: CartState = {
  items: [],
  couponCode: "",
  discount: 0,
};

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find(
        (i) => i.product.id === action.product.id
      );
      if (existing) {
        const newQty = Math.min(
          existing.quantity + action.quantity,
          action.product.stock
        );
        return {
          ...state,
          items: state.items.map((i) =>
            i.product.id === action.product.id
              ? { ...i, quantity: newQty }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            product: action.product,
            quantity: Math.min(action.quantity, action.product.stock),
          },
        ],
      };
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.product.id !== action.productId),
      };

    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.product.id !== action.productId),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === action.productId
            ? { ...i, quantity: Math.min(action.quantity, i.product.stock) }
            : i
        ),
      };
    }

    case "CLEAR_CART":
      return { ...initialState };

    case "APPLY_COUPON":
      return {
        ...state,
        couponCode: action.code,
        discount: action.discount,
      };

    case "HYDRATE":
      return action.state;

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartState;
        if (parsed.items && Array.isArray(parsed.items)) {
          dispatch({ type: "HYDRATE", state: parsed });
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  // Computed values
  const total = state.items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );
  const totalWithDiscount = Math.max(total - state.discount, 0);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const value: CartContextValue = {
    ...state,
    addItem: (product, quantity = 1) =>
      dispatch({ type: "ADD_ITEM", product, quantity }),
    removeItem: (productId) =>
      dispatch({ type: "REMOVE_ITEM", productId }),
    updateQuantity: (productId, quantity) =>
      dispatch({ type: "UPDATE_QUANTITY", productId, quantity }),
    clearCart: () => dispatch({ type: "CLEAR_CART" }),
    applyCoupon: (code, discount) =>
      dispatch({ type: "APPLY_COUPON", code, discount }),
    total,
    totalWithDiscount,
    itemCount,
  };

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
