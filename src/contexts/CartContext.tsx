import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateCoupon } from "@/lib/catalog";
import {
  calculateCartDiscounts,
  parsePromotionRule,
  type CartCalculation,
  type CartItem,
  type PromotionRule,
} from "@/lib/promotions";

const CART_STORAGE_KEY = "editly_cart_v2";

type CartContextType = {
  items: CartItem[];
  addToCart: (product: {
    id: string;
    slug: string;
    title: string;
    price: number;
    originalPrice?: number;
    isFree?: boolean;
    cover?: string;
    downloadLink?: string | null;
    category?: string;
  }) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  couponCode: string;
  coupon: { code: string; percent_off: number } | null;
  applyCouponCode: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  calculation: CartCalculation;
  itemCount: number;
  promotions: PromotionRule[];
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; percent_off: number } | null>(null);
  const [promotions, setPromotions] = useState<PromotionRule[]>([]);

  // Fetch live active promotions
  useEffect(() => {
    let cancelled = false;
    const fetchPromos = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("sales")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: false });

        if (!error && data && !cancelled) {
          const rules = data.map((r) => parsePromotionRule(r));
          setPromotions(rules);
        }
      } catch (err) {
        console.warn("Could not fetch active promotions:", err);
      }
    };

    void fetchPromos();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, [items]);

  const addToCart = useCallback(
    (product: {
      id: string;
      slug: string;
      title: string;
      price: number;
      originalPrice?: number;
      isFree?: boolean;
      cover?: string;
      downloadLink?: string | null;
      category?: string;
    }) => {
      setItems((prev) => {
        const exists = prev.some((item) => item.id === product.id || item.slug === product.slug);
        if (exists) {
          toast.info(`"${product.title}" is already in your cart`);
          return prev;
        }
        toast.success(`Added "${product.title}" to cart!`);
        return [
          ...prev,
          {
            id: product.id,
            slug: product.slug,
            title: product.title,
            price: Number(product.price) || 0,
            originalPrice: Number(product.originalPrice) || Number(product.price) || 0,
            isFree: Boolean(product.isFree),
            cover: product.cover || "",
            downloadLink: product.downloadLink ?? null,
            category: product.category || "Asset",
            quantity: 1,
          },
        ];
      });
      setIsOpen(true);
    },
    [],
  );

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === productId || i.slug === productId);
      if (target) {
        toast.info(`Removed "${target.title}" from cart`);
      }
      return prev.filter((i) => i.id !== productId && i.slug !== productId);
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
    setCouponCode("");
  }, []);

  const isInCart = useCallback(
    (productId: string) => items.some((item) => item.id === productId || item.slug === productId),
    [items],
  );

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const applyCouponCode = useCallback(async (code: string) => {
    const clean = code.trim();
    if (!clean) {
      toast.error("Please enter a coupon code");
      return false;
    }
    const validated = await validateCoupon(clean);
    if (!validated) {
      toast.error(`Coupon "${clean.toUpperCase()}" is invalid or expired`);
      return false;
    }
    setCouponCode(clean.toUpperCase());
    setCoupon({ code: clean.toUpperCase(), percent_off: validated.percent_off });
    toast.success(`Coupon applied: ${validated.percent_off}% off!`);
    return true;
  }, []);

  const removeCoupon = useCallback(() => {
    setCoupon(null);
    setCouponCode("");
    toast.info("Coupon removed");
  }, []);

  const calculation = useMemo(
    () => calculateCartDiscounts(items, promotions, coupon),
    [items, promotions, coupon],
  );

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      clearCart,
      isInCart,
      isOpen,
      openCart,
      closeCart,
      toggleCart,
      couponCode,
      coupon,
      applyCouponCode,
      removeCoupon,
      calculation,
      itemCount: items.length,
      promotions,
    }),
    [
      items,
      addToCart,
      removeFromCart,
      clearCart,
      isInCart,
      isOpen,
      openCart,
      closeCart,
      toggleCart,
      couponCode,
      coupon,
      applyCouponCode,
      removeCoupon,
      calculation,
      promotions,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
