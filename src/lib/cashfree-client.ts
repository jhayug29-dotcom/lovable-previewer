type CashfreeCheckout = (options: {
  paymentSessionId: string;
  redirectTarget?: "_self" | "_blank" | "_modal";
}) => Promise<unknown>;

type CashfreeFactory = (config: { mode: "production" | "sandbox" }) => { checkout: CashfreeCheckout };

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

let loader: Promise<CashfreeFactory> | undefined;

function loadSdk(): Promise<CashfreeFactory> {
  if (loader) return loader;
  loader = new Promise<CashfreeFactory>((resolve, reject) => {
    const existing = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      const factory = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
      if (factory) resolve(factory);
      else reject(new Error("Cashfree SDK failed to initialise"));
    };
    script.onerror = () => reject(new Error("Could not load the Cashfree SDK"));
    document.head.appendChild(script);
  });
  return loader;
}

/** production unless VITE_CASHFREE_MODE=sandbox — keeps the app portable across environments. */
const MODE: "production" | "sandbox" =
  (import.meta.env['VITE_CASHFREE_MODE'] as string | undefined) === "sandbox" ? "sandbox" : "production";

/** Opens the Cashfree hosted checkout for a payment session. */
export async function openCashfreeCheckout(paymentSessionId: string) {
  const factory = await loadSdk();
  const cashfree = factory({ mode: MODE });
  await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
}
