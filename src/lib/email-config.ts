/** EmailJS receipt config. Service + template IDs and the public key are publishable values. */
export const EMAILJS = {
  serviceId: (import.meta.env['VITE_EMAILJS_SERVICE_ID'] as string | undefined) ?? "service_tbk5flg",
  templateId: (import.meta.env['VITE_EMAILJS_TEMPLATE_ID'] as string | undefined) ?? "template_e8uqzpz",
  /** EmailJS Public Key — set VITE_EMAILJS_PUBLIC_KEY in your environment. */
  publicKey: (import.meta.env['VITE_EMAILJS_PUBLIC_KEY'] as string | undefined) ?? "",
};

export const isEmailjsConfigured = () => EMAILJS.publicKey.length > 0;
