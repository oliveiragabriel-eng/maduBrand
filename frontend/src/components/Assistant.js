import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const SUGGESTIONS = [
  "Qual peça me dá mais lucro?",
  "Quanto eu lucraria vendendo todo o estoque?",
  "Quais peças têm margem baixa?",
  "Qual o custo médio das minhas peças?",
];

const streamChat = async (message, onDelta) => {
  const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("madu_token")}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Erro ao enviar mensagem");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop();
    for (const ev of events) {
      const data = ev.replace(/^data: /, "");
      if (data === "[DONE]") return;
      const parsed = JSON.parse(data);
      if (parsed.error) throw new Error(parsed.error);
      onDelta(parsed.delta);
    }
  }
};

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api.get("/assistant/messages").then((r) => setMessages(r.data));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    try {
      await streamChat(msg, (d) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + d };
          return copy;
        })
      );
    } catch (e) {
      toast.error(e.message);
      setMessages((m) => (m[m.length - 1].content ? m : m.slice(0, -1)));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    await api.delete("/assistant/messages");
    setMessages([]);
  };

  return (
    <section className="fade-up max-w-3xl">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8B7355]">Inteligência</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#2B1810] mt-2">Assistente</h1>
          <p className="text-sm text-[#6B5A4E] mt-2">Pergunte sobre seu estoque, custos e lucros.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} data-testid="assistant-clear-button" className="flex items-center gap-2 text-sm text-[#6B5A4E] hover:text-[#2B1810] transition-colors">
            <Trash2 className="w-4 h-4" /> Limpar
          </button>
        )}
      </div>

      <div className="rounded-3xl bg-[#FAF6F0] border border-[#2B1810]/10 p-5 sm:p-7 min-h-[360px] max-h-[60vh] overflow-y-auto space-y-4" data-testid="assistant-messages">
        {messages.length === 0 ? (
          <Suggestions onPick={send} />
        ) : (
          messages.map((m, i) => <Bubble key={i} m={m} typing={busy && i === messages.length - 1} />)
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-4 flex items-center gap-2 rounded-full border border-[#2B1810]/15 bg-[#FAF6F0] pl-5 pr-2 py-2 focus-within:border-[#8B7355] transition-colors">
        <input data-testid="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ex.: Qual peça tem o maior lucro?" className="flex-1 bg-transparent outline-none py-2 text-sm" disabled={busy} />
        <button data-testid="assistant-send-button" disabled={busy || !input.trim()} className="rounded-full bg-[#2B1810] text-[#F3ECE2] p-3 hover:bg-[#5A3A26] transition-colors disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
}

const Suggestions = ({ onPick }) => (
  <div className="h-full flex flex-col items-start justify-center py-6" data-testid="assistant-suggestions">
    <Sparkles className="w-6 h-6 text-[#8B7355]" />
    <p className="font-serif text-2xl text-[#2B1810] mt-3">Como posso ajudar?</p>
    <div className="flex flex-wrap gap-2 mt-5">
      {SUGGESTIONS.map((s, i) => (
        <button key={s} onClick={() => onPick(s)} data-testid={`assistant-suggestion-${i}`} className="text-sm rounded-full bg-[#E6D8C5] text-[#5A3A26] px-4 py-2 hover:bg-[#2B1810] hover:text-[#F3ECE2] transition-colors">{s}</button>
      ))}
    </div>
  </div>
);

const Bubble = ({ m, typing }) => {
  const user = m.role === "user";
  return (
    <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <div data-testid={user ? "assistant-user-message" : "assistant-reply-message"} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${user ? "bg-[#2B1810] text-[#F3ECE2] rounded-br-sm" : "bg-[#EFE4D6] text-[#2B1810] rounded-bl-sm"}`}>
        {m.content || (typing ? <span className="text-[#8B7355] animate-pulse">Pensando...</span> : "")}
      </div>
    </div>
  );
};
