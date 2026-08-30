import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Gift, Tag, ShieldCheck, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { openCashfreeCheckout } from "@/lib/cashfree-client";
import { createCashfreeOrder, claimFreeProduct } from "@/lib/store.functions";
import { validateCoupon } from "@/lib/catalog";
import { formatPrice } from "@/lib/products";

type Props = {
  slug: string;
  price: number;
  isFree?: boolean | undefined;
};

export function BuyButton({ slug, price, isFree }: Props) {
  const { user, session } = useAuth();
  const createOrder = useServerFn(createCashfreeOrder);
  const claimFree = useServerFn(claimFreeProduct);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [freeLink, setFreeLink] = useState<string | null>(null);

  const payable = Math.max(1, Math.round(price * (1 - discount / 100)));

  const applyCoupon = async () => {
    const found = await validateCoupon(coupon);
    if (!found) {
      setDiscount(0);
      toast.error("That coupon isn't valid");
      return;
    }
    setDiscount(found.percent_off);
    toast.success(`${found.percent_off}% off applied`);
  };

  const handleFree = async () => {
    if (!session?.access_token) {
      toast.error("Sign in to claim this free product");
      return;
    }
    setBusy(true);
    try {
      const result = await claimFree({ data: { slug, accessToken: session.access_token } });
      setFreeLink(result.downloadLink ?? null);
      toast.success("Unlocked — your download is ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlock this product");
    } finally {
      setBusy(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await createOrder({
        data: {
          slug,
          origin: window.location.origin,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          ...(coupon.trim() ? { couponCode: coupon.trim() } : {}),
          ...(session?.access_token ? { accessToken: session.access_token } : {}),
        },
      });
      await openCashfreeCheckout(result.paymentSessionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment could not be started");
      setBusy(false);
    }
  };

  // Purchases and free claims are tied to an account, so ask for sign-in first.
  if (!user) {
    return (
      <div className="mt-7">
        <Link
          to="/auth"
          search={{ redirect: `/product/${slug}` }}
          className="btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4.5 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 ease-[var(--ease-macos)] hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95"
        >
          <LogIn className="size-5" strokeWidth={1.8} />
          Sign in to {isFree ? "download free" : "buy this pack"}
        </Link>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" strokeWidth={1.7} />
          Takes a few seconds — your downloads stay in your account forever
        </p>
      </div>
    );
  }

  if (isFree) {
    return (
      <div className="mt-7">
        {freeLink ? (
          <a
            href={freeLink}
            target="_blank"
            rel="noreferrer"
            className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4.5 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 hover:-translate-y-0.5"
          >
            <Download className="size-5" strokeWidth={1.8} />
            Download now
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void handleFree()}
            disabled={busy}
            className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4.5 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Gift className="size-5" strokeWidth={1.8} />
            )}
            Get it free
          </button>
        )}
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" strokeWidth={1.7} />
          Free download · commercial licence included
        </p>
      </div>
    );
  }

  return (
    <div className="mt-7">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-shine group flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4.5 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 ease-[var(--ease-macos)] hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95"
        >
          <Download
            className="size-5 transition-transform duration-500 group-hover:translate-y-0.5"
            strokeWidth={1.8}
          />
          Buy now — instant download
        </button>
      ) : (
        <form onSubmit={handlePay} className="animate-rise-in space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-2xl bg-white/65 px-5 py-3.5 text-sm font-medium text-ink outline-none transition-colors focus:bg-white/90"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email for the receipt"
            className="w-full rounded-2xl bg-white/65 px-5 py-3.5 text-sm font-medium text-ink outline-none transition-colors focus:bg-white/90"
          />
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-2xl bg-white/65 px-5 py-3.5 text-sm font-medium text-ink outline-none transition-colors focus:bg-white/90"
          />
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="w-full rounded-2xl bg-white/65 px-5 py-3.5 text-sm font-medium uppercase text-ink outline-none transition-colors focus:bg-white/90"
            />
            <button
              type="button"
              onClick={() => void applyCoupon()}
              className="hover-pop flex shrink-0 items-center gap-2 rounded-2xl bg-white/70 px-5 text-sm font-semibold text-ink"
            >
              <Tag className="size-4" strokeWidth={1.8} />
              Apply
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4.5 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Download className="size-5" strokeWidth={1.8} />
            )}
            Pay {formatPrice(payable)} securely
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
