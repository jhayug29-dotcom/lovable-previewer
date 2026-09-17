import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Mail,
  Copy,
  Check,
  Clock,
  Receipt,
  RotateCw,
  ExternalLink,
  Package,
  Sparkles,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { verifyCashfreeOrder, resendReceiptEmail } from "@/lib/store.functions";
import { sendReceipt } from "@/lib/receipt";
import { isEmailjsConfigured } from "@/lib/email-config";
import { formatPrice } from "@/lib/products";
import { toast } from "sonner";

type Search = { order_id?: string };

export const Route = createFileRoute("/payment/status")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["order_id"] === "string" ? { order_id: search["order_id"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Order Receipt — Editly Store" },
      {
        name: "description",
        content: "Your Editly Store payment receipt and instant product download links.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Order Receipt — Editly Store" },
      {
        property: "og:description",
        content: "Your Editly Store order receipt and instant download access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaymentStatusPage,
});

type Result = Awaited<ReturnType<typeof verifyCashfreeOrder>>;

function formatTransactionTime(isoString?: string | null): string {
  if (!isoString) return new Date().toLocaleString();
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return (
      d.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }) + " IST"
    );
  } catch {
    return isoString;
  }
}

/** Animated SVG checkmark confirmation with green glowing ripple effect */
function AnimatedConfirmationCheckmark() {
  return (
    <div className="relative mx-auto flex size-20 items-center justify-center">
      <span
        className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"
        style={{ animationDuration: "2.5s" }}
      />
      <span className="absolute inset-1 rounded-full bg-emerald-500/15" />
      <svg viewBox="0 0 52 52" className="relative size-16 drop-shadow-md" fill="none">
        <circle
          cx="26"
          cy="26"
          r="24"
          stroke="#10b981"
          strokeWidth="3.5"
          className="stroke-emerald-500"
          strokeDasharray="166"
          strokeDashoffset="166"
          style={{
            animation: "strokeDraw 0.55s cubic-bezier(0.65, 0, 0.45, 1) forwards",
          }}
        />
        <path
          d="M14 27l8 8 16-16"
          fill="none"
          stroke="#10b981"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="48"
          strokeDashoffset="48"
          style={{
            animation: "strokeDraw 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.45s forwards",
          }}
        />
      </svg>
      <style>{`
        @keyframes strokeDraw {
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

function PaymentStatusPage() {
  const { order_id: orderId } = Route.useSearch();
  const verify = useServerFn(verifyCashfreeOrder);
  const resendReceipt = useServerFn(resendReceiptEmail);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const mailSent = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setError("No order reference found in the link");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const run = async () => {
      try {
        const data = await verify({ data: { orderId } });
        if (cancelled) return;
        setResult(data);

        if (data.status === "PAID") {
          if (data.receiptSent) {
            setEmailed(true);
          } else if (data.email && !mailSent.current && isEmailjsConfigured()) {
            mailSent.current = true;
            const primaryLink =
              data.downloadLink || `${window.location.origin}/product/${data.productSlug}`;
            const ok = await sendReceipt({
              toEmail: data.email,
              customerName:
                (data as { customerName?: string | null }).customerName ||
                data.email.split("@")[0] ||
                "Valued Customer",
              customerPhone: data.phone ?? "",
              productName: data.productTitle,
              amount: data.amount,
              orderId,
              downloadLink: primaryLink,
              storeName: "Editly Store",
            }).catch(() => false);
            if (!cancelled && ok) setEmailed(true);
          }
          return;
        }

        // Check again quietly for bank delay
        if (data.status === "PENDING" && attempts < 12) {
          attempts += 1;
          timer = setTimeout(() => void run(), 3000);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Verification failed");
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, verify]);

  const handleCopyLink = (linkText: string, id: string) => {
    if (!linkText) return;
    navigator.clipboard.writeText(linkText);
    setCopiedId(id);
    toast.success("Download link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleResendEmail = async () => {
    if (!orderId || isResending) return;
    setIsResending(true);
    try {
      const res = await resendReceipt({
        data: { orderId, email: result?.email || undefined },
      });
      if (res.success) {
        setEmailed(true);
        toast.success(res.message);
      } else {
        // Fallback to browser-side EmailJS
        if (result?.email && isEmailjsConfigured()) {
          const primaryLink =
            result.downloadLink || `${window.location.origin}/product/${result.productSlug}`;
          const ok = await sendReceipt({
            toEmail: result.email,
            customerName:
              result.customerName || result.email.split("@")[0] || "Valued Customer",
            customerPhone: result.phone || "",
            productName: result.productTitle,
            amount: result.amount,
            orderId,
            downloadLink: primaryLink,
            storeName: "Editly Store",
          });
          if (ok) {
            setEmailed(true);
            toast.success(`Receipt delivered to ${result.email}`);
            return;
          }
        }
        toast.error(res.message || "Failed to resend receipt");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send receipt");
    } finally {
      setIsResending(false);
    }
  };

  const itemsList = result?.items && result.items.length > 0 ? result.items : null;
  const isFreeOrder = Boolean(result?.isFree || (result && result.amount === 0));

  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[740px] px-4 sm:px-6 pb-24 pt-6">
        <div className="glass animate-rise-in rounded-3xl md:rounded-4xl p-6 sm:p-10 text-center border border-white/10 shadow-2xl backdrop-blur-xl">
          {error ? (
            <>
              <XCircle className="mx-auto size-14 text-destructive" strokeWidth={1.6} />
              <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">
                Something went wrong
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </>
          ) : !result ? (
            <>
              <Loader2 className="mx-auto size-12 animate-spin text-primary" />
              <h1 className="mt-5 font-display text-2xl font-extrabold text-ink">
                Confirming your order…
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Verifying transaction details and unlocking your downloads.
              </p>
            </>
          ) : result.status === "PAID" ? (
            <>
              {/* Confirmation Animation */}
              <AnimatedConfirmationCheckmark />

              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-4 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/25">
                <Sparkles className="size-3.5" />
                <span>
                  {isFreeOrder
                    ? "Free Claim Confirmed · Commercial License Included"
                    : "Payment Confirmed · Verified Purchase"}
                </span>
              </div>

              <h1 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                {isFreeOrder ? "Thank you! Your downloads are ready" : "Thank you for your purchase!"}
              </h1>
              <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                {isFreeOrder
                  ? "Your free order is complete. You have full instant access to all files below."
                  : "Your payment was processed successfully. You can download your files immediately below."}
              </p>

              {/* Multi-Item / Single-Item Product Downloads Section */}
              <div className="mt-8 space-y-4 text-left">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Package className="size-4" />
                    <span>Your Purchased Products ({itemsList?.length || 1})</span>
                  </h3>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="size-3" /> Ready to download
                  </span>
                </div>

                {itemsList && itemsList.length > 0 ? (
                  <div className="space-y-3">
                    {itemsList.map((item, idx) => {
                      const itemLink =
                        item.downloadLink ||
                        (item.slug
                          ? `${typeof window !== "undefined" ? window.location.origin : ""}/product/${item.slug}`
                          : "");
                      const isItemCopied = copiedId === item.id;

                      return (
                        <div
                          key={item.id || idx}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 transition hover:border-primary/40 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Product {idx + 1}
                              </span>
                              <h4 className="font-display text-base font-bold text-ink truncate">
                                {item.title}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {item.category || "Digital Preset"}
                              </p>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                              <span className="font-display text-sm font-extrabold text-ink">
                                {item.isFree || item.price === 0 ? (
                                  <span className="text-emerald-400 font-bold">Free</span>
                                ) : (
                                  formatPrice(item.price)
                                )}
                              </span>
                            </div>
                          </div>

                          {itemLink && (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                              <a
                                href={itemLink}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-shine inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-display text-xs font-bold text-primary-foreground shadow-sm transition hover:scale-[1.01] active:scale-[0.99] shrink-0"
                              >
                                <Download className="size-4" strokeWidth={2} />
                                <span>Download Product {idx + 1}</span>
                              </a>

                              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/40 bg-background/80 px-3 py-2 text-xs">
                                <span className="truncate flex-1 font-mono text-[11px] text-ink/80 select-all">
                                  {itemLink}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(itemLink, item.id)}
                                  className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-[10px] font-semibold text-ink shadow-xs transition hover:bg-card/80 shrink-0 cursor-pointer"
                                  title="Copy link"
                                >
                                  {isItemCopied ? (
                                    <>
                                      <Check className="size-3 text-emerald-400" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Single product fallback */
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 space-y-3">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-display text-base font-bold text-ink">
                        {result.productTitle}
                      </h4>
                      <span className="font-display text-sm font-bold text-emerald-400">
                        {isFreeOrder ? "Free" : formatPrice(result.amount)}
                      </span>
                    </div>

                    {result.downloadLink && (
                      <div className="pt-2 space-y-2">
                        <a
                          href={result.downloadLink}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-shine w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-display text-sm font-bold text-primary-foreground shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <Download className="size-4.5" strokeWidth={2} />
                          <span>Download Your Files Now</span>
                        </a>

                        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/80 px-3 py-2 text-xs">
                          <span className="truncate flex-1 font-mono text-[11px] text-ink/80 select-all">
                            {result.downloadLink}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(result.downloadLink!, "primary")}
                            className="inline-flex items-center gap-1 rounded-md bg-card px-2.5 py-1 text-[11px] font-semibold text-ink shadow-xs transition hover:bg-card/80 shrink-0 cursor-pointer"
                          >
                            {copiedId === "primary" ? (
                              <>
                                <Check className="size-3 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copy link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order & Transaction Details Breakdown */}
              <div className="mt-7 rounded-2xl border border-border/50 bg-card/40 p-4 sm:p-5 text-left text-xs sm:text-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2.5">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <Receipt className="size-4 text-accent" /> Order Breakdown
                  </span>
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                      isFreeOrder
                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                        : "text-accent bg-accent/10"
                    }`}
                  >
                    {isFreeOrder ? "Free Order" : "Paid"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Amount Paid */}
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span
                      className={`font-bold text-sm ${
                        isFreeOrder ? "text-emerald-400" : "text-accent"
                      }`}
                    >
                      {isFreeOrder ? "Free" : formatPrice(result.amount)}
                    </span>
                  </div>

                  {/* Order ID */}
                  {orderId && (
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Order Reference</span>
                      <span className="font-mono text-ink/90 font-medium">{orderId}</span>
                    </div>
                  )}

                  {/* Total Items */}
                  {itemsList && (
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Total Items</span>
                      <span className="font-medium text-ink">
                        {itemsList.length} {itemsList.length === 1 ? "Product" : "Products"}
                      </span>
                    </div>
                  )}

                  {/* Transaction Time */}
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3.5 text-muted-foreground/70" /> Order Time
                    </span>
                    <span className="font-medium text-ink/90">
                      {formatTransactionTime(result.paidAt)}
                    </span>
                  </div>

                  {/* Customer Name */}
                  {result.customerName && (
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Customer Name</span>
                      <span className="font-medium text-ink">{result.customerName}</span>
                    </div>
                  )}

                  {/* Customer Email */}
                  {result.email && (
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium text-ink">{result.email}</span>
                    </div>
                  )}

                  {/* Customer Phone */}
                  {result.phone && (
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Phone Number</span>
                      <span className="font-medium text-ink">{result.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Notification & Resend Receipt */}
              <div className="mt-6 rounded-2xl border border-border/40 bg-card/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-left">
                  <Mail className="size-4 text-accent shrink-0" strokeWidth={1.8} />
                  <span>
                    {emailed
                      ? `Receipt and download links emailed to ${result.email || "your email"}`
                      : result.email
                        ? `Receipt email dispatched to ${result.email}`
                        : "Confirmation email sent."}
                  </span>
                </div>
                {result.email && (
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={isResending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-card shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCw className={`size-3.5 ${isResending ? "animate-spin" : ""}`} />
                    <span>{isResending ? "Sending…" : "Resend receipt"}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <XCircle className="mx-auto size-14 text-destructive" strokeWidth={1.6} />
              <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">
                {result.status === "PENDING" ? "Payment pending" : "Payment failed"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.status === "PENDING"
                  ? "We're still waiting on your bank — this page updates itself automatically."
                  : "No payment was captured. You can try the purchase again from the store."}
              </p>
            </>
          )}

          <div className="mt-8">
            <Link
              to="/store"
              className="text-sm font-semibold text-ink/75 transition hover:text-ink"
            >
              ← Back to store
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
export default PaymentStatusPage;
