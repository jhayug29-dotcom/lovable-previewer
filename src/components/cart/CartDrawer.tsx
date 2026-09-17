import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ShoppingBag,
  X,
  Trash2,
  Tag,
  ArrowRight,
  ShieldCheck,
  Gift,
  Loader2,
  Sparkles,
  Lock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { checkoutCart, checkoutFreeCart } from "@/lib/cart.functions";
import { openCashfreeCheckout } from "@/lib/cashfree-client";
import { formatPrice } from "@/lib/products";
import { getReferralCode } from "@/lib/referral";

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeFromCart,
    clearCart,
    calculation,
    couponCode,
    coupon,
    applyCouponCode,
    removeCoupon,
    promotions,
  } = useCart();

  const { user, session } = useAuth();
  const navigate = useNavigate();

  const runCheckout = useServerFn(checkoutCart);
  const runFreeCheckout = useServerFn(checkoutFreeCart);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inputCoupon, setInputCoupon] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Sync user details if logged in
  useEffect(() => {
    if (user) {
      if (user.email && !email) setEmail(user.email);
      const fullName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string);
      if (fullName && !name) setName(fullName);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    setIsApplyingCoupon(true);
    try {
      const ok = await applyCouponCode(inputCoupon);
      if (ok) setInputCoupon("");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const cleanEmail = email.trim();
    const cleanName = name.trim() || cleanEmail.split("@")[0] || "Valued Customer";
    const cleanPhone = phone.replace(/\D/g, "");

    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (calculation.payableTotal > 0 && cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number for payment confirmation");
      return;
    }

    setIsCheckingOut(true);
    try {
      const collaboratorCode = getReferralCode() ?? undefined;
      const origin = window.location.origin;

      // Free cart claim
      if (calculation.payableTotal === 0) {
        const res = await runFreeCheckout({
          data: {
            items: items.map((i) => ({
              id: i.id,
              slug: i.slug,
              title: i.title,
              price: i.price,
              originalPrice: i.originalPrice,
              isFree: i.isFree,
            })),
            customerName: cleanName,
            customerEmail: cleanEmail,
            customerPhone: cleanPhone || undefined,
            accessToken: session?.access_token,
            collaboratorCode,
            origin,
          },
        });

        clearCart();
        closeCart();
        toast.success("Products unlocked! Opening your receipt and downloads...");
        await navigate({
          to: "/payment/status",
          search: { order_id: res.orderId },
        });
        return;
      }

      // Paid cart checkout via Cashfree
      const res = await runCheckout({
        data: {
          items: items.map((i) => ({
            id: i.id,
            slug: i.slug,
            title: i.title,
            price: i.price,
            originalPrice: i.originalPrice,
            isFree: i.isFree,
          })),
          origin,
          customerName: cleanName,
          customerEmail: cleanEmail,
          customerPhone: cleanPhone,
          couponCode: coupon?.code,
          accessToken: session?.access_token,
          collaboratorCode,
        },
      });

      if (res.isFree && res.orderId) {
        clearCart();
        closeCart();
        await navigate({
          to: "/payment/status",
          search: { order_id: res.orderId },
        });
        return;
      }

      if (res.paymentSessionId) {
        clearCart();
        closeCart();
        await openCashfreeCheckout(res.paymentSessionId, res.cashfreeMode);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Slide-over panel */}
      <aside className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="glass flex w-screen max-w-md flex-col border-l border-white/15 bg-background/95 shadow-2xl backdrop-blur-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                <ShoppingBag className="size-4.5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Your Cart</h2>
                <p className="text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "item" : "items"} selected
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeCart}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-white/40 hover:text-ink"
              aria-label="Close cart"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Cart Contents */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center py-12">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-muted/60 text-muted-foreground">
                  <ShoppingBag className="size-8 stroke-[1.5]" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">Your cart is empty</h3>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Explore our video editing presets, LUTs, and After Effects motion packs to add items.
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  Browse Store Assets
                </button>
              </div>
            ) : (
              <>
                {/* Active Promotions Notification Banner */}
                {calculation.appliedPromotions.length > 0 ? (
                  <div className="rounded-2xl border border-accent/25 bg-accent/10 p-3 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-accent">
                      <Sparkles className="size-4 shrink-0" />
                      <span>Promotion Applied!</span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-accent/90 pl-6 list-disc">
                      {calculation.appliedPromotions.map((p) => (
                        <li key={p.id}>{p.title}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Items List */}
                <div className="divide-y divide-border/20">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-3.5"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {item.cover ? (
                          <img
                            src={item.cover}
                            alt={item.title}
                            className="size-14 rounded-2xl object-cover border border-border/40 shrink-0"
                          />
                        ) : (
                          <div className="size-14 rounded-2xl bg-muted/60 border border-border/40 shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
                            FX
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-display text-sm font-bold text-ink">
                            {item.title}
                          </h4>
                          <span className="text-[11px] text-muted-foreground">
                            {item.category || "Asset"}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="font-display text-xs font-extrabold text-ink">
                              {item.isFree ? (
                                <span className="text-emerald-500 font-bold">Free</span>
                              ) : (
                                formatPrice(item.price)
                              )}
                            </span>
                            {item.originalPrice > item.price ? (
                              <span className="text-[11px] text-muted-foreground line-through">
                                {formatPrice(item.originalPrice)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="rounded-xl p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive shrink-0"
                        title="Remove from cart"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </article>
                  ))}
                </div>

                {/* Coupon Code Section */}
                <div className="rounded-2xl border border-border/40 bg-card/30 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Tag className="size-3.5 text-primary" />
                    <span>Have a promo coupon?</span>
                  </div>
                  {coupon ? (
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-accent/15 border border-accent/25 px-3 py-1.5 text-xs text-accent">
                      <span className="font-mono font-bold">
                        {coupon.code} ({coupon.percent_off}% OFF)
                      </span>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-accent/80 hover:text-accent font-semibold ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={inputCoupon}
                        onChange={(e) => setInputCoupon(e.target.value.toUpperCase())}
                        placeholder="Enter coupon code"
                        className="flex-1 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 font-mono text-xs text-ink outline-none uppercase placeholder:normal-case focus:border-primary"
                      />
                      <button
                        type="submit"
                        disabled={isApplyingCoupon || !inputCoupon.trim()}
                        className="rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-ink/90 disabled:opacity-50"
                      >
                        {isApplyingCoupon ? <Loader2 className="size-3.5 animate-spin" /> : "Apply"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Order Summary Calculations */}
                <div className="rounded-2xl border border-border/40 bg-card/20 p-4 text-xs space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items Subtotal</span>
                    <span>{formatPrice(calculation.subtotal)}</span>
                  </div>

                  {calculation.discounts.map((disc) => (
                    <div key={disc.id} className="flex justify-between text-emerald-500 font-medium">
                      <span>{disc.title}</span>
                      <span>-{formatPrice(disc.amount)}</span>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-border/30 flex justify-between items-baseline">
                    <span className="font-display font-bold text-sm text-ink">Total Payable</span>
                    <span className="font-display text-lg font-extrabold text-ink">
                      {calculation.payableTotal === 0 ? (
                        <span className="text-emerald-500">Free</span>
                      ) : (
                        formatPrice(calculation.payableTotal)
                      )}
                    </span>
                  </div>

                  {calculation.savingsTotal > 0 ? (
                    <p className="text-[11px] font-semibold text-emerald-500 text-right">
                      You are saving {formatPrice(calculation.savingsTotal)} today!
                    </p>
                  ) : null}
                </div>

                {/* Checkout Buyer Details Form */}
                <form id="cart-checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2">
                  <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Recipient / Download Info
                  </h4>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-border/60 bg-background/90 px-3 py-2 text-xs text-ink outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Email Address (Instant download links sent here)
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full rounded-xl border border-border/60 bg-background/90 px-3 py-2 text-xs text-ink outline-none focus:border-primary"
                    />
                  </div>

                  {calculation.payableTotal > 0 ? (
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Phone Number (Required by Cashfree)
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full rounded-xl border border-border/60 bg-background/90 px-3 py-2 text-xs text-ink outline-none focus:border-primary"
                      />
                    </div>
                  ) : null}
                </form>
              </>
            )}
          </div>

          {/* Footer Checkout Action */}
          {items.length > 0 ? (
            <div className="border-t border-border/40 p-6 bg-card/30">
              <button
                type="submit"
                form="cart-checkout-form"
                disabled={isCheckingOut}
                className="btn-shine flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-display text-sm font-bold text-primary-foreground shadow-lg transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isCheckingOut ? (
                  <Loader2 className="size-4.5 animate-spin" />
                ) : calculation.payableTotal === 0 ? (
                  <Gift className="size-4.5" />
                ) : (
                  <Lock className="size-4.5" />
                )}
                <span>
                  {isCheckingOut
                    ? "Processing Order..."
                    : calculation.payableTotal === 0
                      ? "Claim All Products Free"
                      : `Pay ${formatPrice(calculation.payableTotal)} & Download`}
                </span>
              </button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-accent" />
                <span>Instant download link & email receipt delivered immediately</span>
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
