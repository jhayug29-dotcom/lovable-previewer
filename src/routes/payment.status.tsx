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
      { title: "Payment status — Editly Store" },
      {
        name: "description",
        content: "Your Editly Store payment status and instant download link.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Payment status — Editly Store" },
      {
        property: "og:description",
        content: "Your Editly Store payment status and download link.",
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

function PaymentStatusPage() {
  const { order_id: orderId } = Route.useSearch();
  const verify = useServerFn(verifyCashfreeOrder);
  const resendReceipt = useServerFn(resendReceiptEmail);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const mailSent = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setError("No order reference in the link");
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
            // Immediate client-side fallback if server-side delivery hasn't recorded yet
            mailSent.current = true;
            const link =
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
              downloadLink: link,
              storeName: "Editly Store",
            }).catch(() => false);
            if (!cancelled && ok) setEmailed(true);
          }
          return;
        }

        // Banks can take a few seconds to confirm — keep checking quietly.
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

  const targetLink =
    result?.downloadLink ||
    (result?.productSlug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/product/${result.productSlug}`
      : "");

  const handleCopyLink = () => {
    if (!targetLink) return;
    navigator.clipboard.writeText(targetLink);
    setCopied(true);
    toast.success("Download link copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
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
        if (result?.email && targetLink && isEmailjsConfigured()) {
          const ok = await sendReceipt({
            toEmail: result.email,
            customerName:
              result.customerName || result.email.split("@")[0] || "Valued Customer",
            customerPhone: result.phone || "",
            productName: result.productTitle,
            amount: result.amount,
            orderId,
            downloadLink: targetLink,
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

  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[680px] px-4 sm:px-6 pb-24 pt-6">
        <div className="glass animate-rise-in rounded-3xl md:rounded-4xl p-6 sm:p-10 text-center border border-white/10 shadow-2xl backdrop-blur-xl">
          {error ? (
            <>
              <XCircle className="mx-auto size-12 text-destructive" strokeWidth={1.6} />
              <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">
                Something went wrong
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </>
          ) : !result ? (
            <>
              <Loader2 className="mx-auto size-10 animate-spin text-ink/60" />
              <h1 className="mt-5 font-display text-2xl font-extrabold text-ink">
                Confirming your payment…
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Connecting to Cashfree to verify transaction status.
              </p>
            </>
          ) : result.status === "PAID" ? (
            <>
              <CheckCircle2 className="mx-auto size-14 text-accent animate-pulse" strokeWidth={1.8} />
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3.5 py-1 text-xs font-semibold text-accent border border-accent/20">
                <span>Payment Confirmed · Verified Purchase</span>
              </div>
              <h1 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                Thank you for your purchase!
              </h1>
              <p className="mt-1 text-sm sm:text-base text-muted-foreground">
                Your payment was processed successfully. You can download your files immediately below.
              </p>

              {/* Instant Download / Product Access Action Box */}
              {targetLink && (
                <div className="mt-7 space-y-3 rounded-2xl bg-primary/10 border border-primary/20 p-4 sm:p-5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Instant Product Access
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="size-3" /> Ready to download
                    </span>
                  </div>

                  <a
                    href={targetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-shine w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display text-base font-bold text-primary-foreground shadow-lg transition-all duration-300 hover:opacity-95 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Download className="size-5" strokeWidth={2} />
                    {result.downloadLink ? "Download Your Files Now" : "Open Your Product Files"}
                  </a>

                  {/* Copyable Link Field */}
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs">
                    <span className="truncate flex-1 text-left font-mono text-ink/80 text-[11px] sm:text-xs select-all">
                      {targetLink}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 rounded-md bg-card px-2.5 py-1 text-[11px] font-semibold text-ink shadow-xs transition-colors hover:bg-card/80 shrink-0"
                      title="Copy download link"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5 text-accent" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Order & Transaction Details Breakdown */}
              <div className="mt-6 rounded-2xl border border-border/50 bg-card/40 p-4 sm:p-5 text-left text-xs sm:text-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border/30 pb-2.5">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <Receipt className="size-4 text-accent" /> Order Details
                  </span>
                  <span className="font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded text-xs">
                    Paid
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Product Title */}
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-semibold text-ink text-right max-w-[240px] sm:max-w-xs truncate">
                      {result.productTitle}
                    </span>
                  </div>

                  {/* Amount Paid */}
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-bold text-accent text-sm">
                      {formatPrice(result.amount)}
                    </span>
                  </div>

                  {/* Order ID */}
                  {orderId && (
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Order ID</span>
                      <span className="font-mono text-ink/90 font-medium">{orderId}</span>
                    </div>
                  )}

                  {/* Transaction Time */}
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3.5 text-muted-foreground/70" /> Transaction Time
                    </span>
                    <span className="font-medium text-ink/90">
                      {formatTransactionTime(result.paidAt)}
                    </span>
                  </div>

                  {/* Customer Name */}
                  {result.customerName && (
                    <div className="flex justify-between py-1 border-b border-border/20">
                      <span className="text-muted-foreground">Buyer Name</span>
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

              {/* EmailJS Confirmation and Resend Action */}
              <div className="mt-6 rounded-2xl border border-border/40 bg-card/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-left">
                  <Mail className="size-4 text-accent shrink-0" strokeWidth={1.8} />
                  <span>
                    {emailed
                      ? `Receipt and download link emailed to ${result.email || "your email"}`
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-card shrink-0 disabled:opacity-50 cursor-pointer"
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
                  : "No money was taken. You can try the purchase again."}
              </p>
            </>
          )}

          <div className="mt-8">
            <Link
              to="/store"
              className="text-sm font-semibold text-ink/75 transition-colors hover:text-ink"
            >
              ← Back to store
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
