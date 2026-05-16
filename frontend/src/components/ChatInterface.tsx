"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import AudioVisualizer from "./AudioVisualizer";
import ChatMessage from "./ChatMessage";
import { useVoicePipeline } from "@/hooks/useVoicePipeline";
import { sendMessage, synthesizeSpeech } from "@/lib/api";
import type { Message } from "@/lib/api";

const STATUS = {
  disconnected: { label: "Offline",       color: "rgba(255,255,255,0.1)",  glow: "none" },
  idle:         { label: "Say 'Monday'",  color: "rgba(255,255,255,0.15)", glow: "none" },
  listening:    { label: "Listening",     color: "#ef4444",                glow: "rgba(239,68,68,0.6)" },
  processing:   { label: "Processing",   color: "rgba(255,255,255,0.4)",  glow: "none" },
  thinking:     { label: "Thinking",     color: "rgba(255,255,255,0.4)",  glow: "none" },
  speaking:     { label: "Speaking",     color: "#c9943a",                glow: "rgba(201,148,58,0.7)" },
} as const;

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Good day. I'm Monday. How can I assist you?" },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const voice = "F4";

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Stable refs so pipeline callbacks always see fresh state
  const messagesRef = useRef(messages);
  const thinkingRef = useRef(thinking);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const stopAudio = useCallback(() => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    setSpeaking(false);
  }, []);

  const playAudio = useCallback(async (text: string) => {
    try {
      setSpeaking(true);
      const buffer = await synthesizeSpeech(text, voice);
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const decoded = await ctx.decodeAudioData(buffer);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      sourceRef.current = src;
      src.start();
      src.onended = () => { sourceRef.current = null; setSpeaking(false); };
    } catch { setSpeaking(false); }
  }, [voice]);

  const submit = useCallback(async (userText: string) => {
    const text = userText.trim();
    if (!text || thinkingRef.current) return;

    const newMessages: Message[] = [...messagesRef.current, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setThinking(true);
    setStreamingContent("");

    let full = "";
    await sendMessage(
      newMessages,
      (chunk) => { full += chunk; setStreamingContent(full); },
      () => {
        setMessages((prev) => [...prev, { role: "assistant", content: full }]);
        setStreamingContent("");
        setThinking(false);
        playAudio(full);
      },
    );
  }, [playAudio]);

  const handleTranscript = useCallback((text: string) => {
    stopAudio();
    submit(text);
  }, [stopAudio, submit]);

  const handleWake = useCallback(() => stopAudio(), [stopAudio]);

  const { state: voiceState, analyser, connect } = useVoicePipeline(handleTranscript, handleWake);

  const statusKey: keyof typeof STATUS =
    voiceState === "listening"  ? "listening"
    : voiceState === "processing" ? "processing"
    : thinking                    ? "thinking"
    : speaking                    ? "speaking"
    : voiceState === "idle"       ? "idle"
    : "disconnected";

  const { label, color, glow } = STATUS[statusKey];
  const isActive = voiceState === "listening" || speaking || thinking;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-6">

      {/* ── Entity ── */}
      <div className="flex flex-col items-center">
        <AudioVisualizer analyser={analyser} active={isActive} />

        <div className="flex items-center gap-5 mt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={statusKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: color,
                  boxShadow: glow !== "none" ? `0 0 8px ${glow}` : "none",
                  animation: statusKey === "listening" ? "pulse 1.2s ease-in-out infinite" : "none",
                }}
              />
              <span
                className="font-mono uppercase"
                style={{ fontSize: "10px", letterSpacing: "0.32em", color: "rgba(255,255,255,0.28)" }}
              >
                {label}
              </span>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {voiceState === "disconnected" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={connect}
                style={{
                  padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                  border: "1px solid rgba(201,148,58,0.35)",
                  background: "rgba(201,148,58,0.06)",
                  color: "rgba(201,148,58,0.75)",
                  fontSize: "9px", letterSpacing: "0.2em", fontFamily: "var(--font-geist-mono)",
                  textTransform: "uppercase",
                }}
              >
                Enable Voice
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {speaking && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={stopAudio}
                style={{
                  width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                  border: "1px solid rgba(201,148,58,0.4)",
                  background: "rgba(201,148,58,0.07)",
                  color: "rgba(201,148,58,0.85)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Square size={9} fill="currentColor" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Separator ── */}
      <div
        className="w-full mt-6 mb-6"
        style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,148,58,0.15) 30%, rgba(201,148,58,0.15) 70%, transparent)" }}
      />

      {/* ── Chat ── */}
      <div className="flex flex-col w-full" style={{ height: 240 }}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto pr-1"
          style={{ scrollbarColor: "rgba(201,148,58,0.08) transparent" }}
        >
          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              role={m.role}
              content={m.content}
              onSpeak={m.role === "assistant" ? () => playAudio(m.content) : undefined}
            />
          ))}
          {streamingContent && (
            <ChatMessage role="assistant" content={streamingContent} streaming />
          )}
          {thinking && !streamingContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 mb-6"
            >
              <span
                className="font-mono uppercase"
                style={{ fontSize: "9px", letterSpacing: "0.28em", color: "rgba(201,148,58,0.6)" }}
              >
                Monday
              </span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="rounded-full"
                    style={{ width: 3, height: 3, background: "rgba(201,148,58,0.65)" }}
                    animate={{ opacity: [0.15, 1, 0.15] }}
                    transition={{ duration: 1.1, delay: i * 0.16, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Text input */}
        <div
          className="input-bar"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}
        >
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) submit(input);
              }}
              placeholder="Query..."
              disabled={thinking}
              className="flex-1 bg-transparent outline-none disabled:opacity-30"
              style={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.72)",
                caretColor: "#c9943a",
                letterSpacing: "0.01em",
                fontFamily: "var(--font-geist-mono)",
              }}
              onFocus={(e) => {
                const bar = e.currentTarget.closest(".input-bar") as HTMLElement;
                if (bar) bar.style.borderTopColor = "rgba(201,148,58,0.3)";
              }}
              onBlur={(e) => {
                const bar = e.currentTarget.closest(".input-bar") as HTMLElement;
                if (bar) bar.style.borderTopColor = "rgba(255,255,255,0.07)";
              }}
            />
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || thinking}
              className="flex items-center justify-center transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed"
              style={{
                width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "rgba(255,255,255,0.38)",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                if (!el.disabled) {
                  el.style.borderColor = "rgba(201,148,58,0.55)";
                  el.style.color = "#c9943a";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "rgba(255,255,255,0.1)";
                el.style.color = "rgba(255,255,255,0.38)";
              }}
            >
              <ArrowUp size={12} />
            </button>
          </div>
          <div className="mt-3">
            <span
              className="font-mono uppercase"
              style={{ fontSize: "8px", letterSpacing: "0.28em", color: "rgba(255,255,255,0.1)" }}
            >
              Enter ↵ to send · Say &apos;Monday&apos; to speak
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
