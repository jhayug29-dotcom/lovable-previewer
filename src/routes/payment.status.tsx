import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Loader2, Download, Mail } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { verifyCashfreeOrder } from "@/lib/store.functions";
import { sendReceipt } from "@/lib/receipt";
import { isEmailjsConfigured } from "@/lib/email-config";
import { formatPrice } from "@/lib/products";

type Search = { order_id?: string };

export const Route = createFileRoute("/payment/status")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search['order_id'] === "string" ? { order_id: search['order_id'] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Payment status — Editly Store" },
      { name: "description", content: "Your Editly Store payment status and instant download link." },
      { property: "og:title", content: "Payment status — Editly Store" },
      { property: "og:description", content: "Your Editly Store payment status and download link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaymentStatusPage,
});

type Result = Awaited<ReturnType<typeof verifyCashfreeOrder>>;

function PaymentStatusPage() {
  const { order_id: orderId } = Route.useSearch();
  const verify = useServerFn(verifyCashfreeOrder);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
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
          if (data.receiptSent) setEmailed(true);
          // Browser fallback: only if the server-side receipt didn't go out.
          else if (data.email && !mailSent.current && isEmailjsConfigured()) {
            mailSent.current = true;
            const ok = await sendReceipt({
              toEmail: data.email,
              customerName: data.email.split("@")[0] ?? "there",
              productName: data.productTitle,
              amount: data.amount,
              orderId,
              downloadLink: data.downloadLink ?? `${window.location.origin}/product/${data.productSlug}`,
            }).catch(() => false);
            if (!cancelled) setEmailed(ok);
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

  return (
    <SiteLayout>
      <section className="mx-auto max-w-[640px] px-6 pb-24">
        <div className="glass animate-rise-in rounded-4xl p-10 text-center">
          {error ? (
            <>
              <XCircle className="mx-auto size-12 text-destructive" strokeWidth={1.6} />
              <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">Something went wrong</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </>
          ) : !result ? (
            <>
              <Loader2 className="mx-auto size-10 animate-spin text-ink/60" />
              <h1 className="mt-5 font-display text-2xl font-extrabold text-ink">Confirming your payment…</h1>
            </>
          ) : result.status === "PAID" ? (
            <>
              <CheckCircle2 className="mx-auto size-14 text-accent" strokeWidth={1.6} />
              <h1 className="mt-5 font-display text-3xl font-extrabold text-ink">Payment successful</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.productTitle} · {formatPrice(result.amount)}
              </p>
              {result.downloadLink ? (
                <a
                  href={result.downloadLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-shine mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 hover:-translate-y-0.5"
                >
                  <Download className="size-5" strokeWidth={1.8} />
                  Download your files
                </a>
              ) : (
                <p className="mt-6 rounded-2xl bg-white/60 px-5 py-4 text-sm text-ink/80">
                  Your download link is being prepared and will arrive by email shortly.
                </p>
              )}
              <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Mail className="size-4" strokeWidth={1.7} />
                {emailed ? "Receipt emailed to you" : "Keep this page for your download link"}
              </p>
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
            <Link to="/store" className="text-sm font-semibold text-ink/75 transition-colors hover:text-ink">
              Back to store
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
