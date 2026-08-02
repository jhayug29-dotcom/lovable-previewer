import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askSupportBot } from "@/lib/support.functions";

type Turn = { role: "user" | "assistant"; content: string };
type Topic = "question" | "payment" | "complaint";

const TOPICS: { id: Topic; label: string }[] = [
  { id: "question", label: "Ask a question" },
  { id: "payment", label: "Payment issue" },
  { id: "complaint", label: "Complaint" },
];

const GREETING: Record<Topic, string> = {
  question: "Hi! Ask me anything about the packs, licences or downloads.",
  payment: "Sorry about the trouble. Tell me what happened — include your order ID and the email you paid with.",
  complaint: "I'm listening. Describe the issue and I'll log it for the team right away.",
};

/** Floating support assistant. Bottom-right, storefront only. */
export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic>("question");
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Turn[]>([{ role: "assistant", content: GREETING.question }]);
  const ask = useServerFn(askSupportBot);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const pickTopic = (next: Topic) => {
    setTopic(next);
    setMessages([{ role: "assistant", content: GREETING[next] }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Turn[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await ask({
        data: {
          messages: next.filter((m) => m.role === "user" || messages.indexOf(m) > 0),
          topic,
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I couldn't reach the assistant just now — please email us and we'll pick it up right away.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform duration-500 ease-[var(--ease-macos)] hover:scale-105"
      >
        {open ? <X className="size-6" strokeWidth={1.9} /> : <MessageCircle className="size-6" strokeWidth={1.9} />}
      </button>

      {open ? (
        <div className="glass animate-rise-in fixed bottom-24 right-6 z-50 flex h-[min(560px,72vh)] w-[min(380px,calc(100vw-3rem))] flex-col overflow-hidden rounded-4xl shadow-float">
          <div className="border-b border-white/40 px-5 py-4">
            <p className="font-display text-base font-extrabold text-ink">Editly support</p>
            <p className="text-xs text-muted-foreground">Replies instantly · logged for the team</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTopic(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    topic === t.id ? "bg-primary text-primary-foreground" : "bg-white/60 text-ink/75 hover:bg-white/85"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-white/70 text-ink"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> typing…
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/40 px-4 py-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Your email (so we can reply)"
              aria-label="Your email"
              className="mb-2 w-full rounded-2xl bg-white/65 px-4 py-2 text-xs text-ink outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                placeholder="Type your message…"
                aria-label="Message"
                className="h-11 flex-1 rounded-2xl bg-white/65 px-4 text-sm text-ink outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="size-4.5" strokeWidth={1.9} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
