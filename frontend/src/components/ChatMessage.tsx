"use client";
import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  onSpeak?: () => void;
}

export default function ChatMessage({ role, content, streaming, onSpeak }: Props) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-7 group`}
    >
      {isUser ? (
        <div className="max-w-[72%] text-right">
          <span
            className="font-mono uppercase block mb-1.5"
            style={{ fontSize: "9px", letterSpacing: "0.28em", color: "rgba(255,255,255,0.18)" }}
          >
            You
          </span>
          <p className="text-sm leading-relaxed font-light" style={{ color: "rgba(255,255,255,0.42)" }}>
            {content}
          </p>
        </div>
      ) : (
        <div className="max-w-[80%]">
          <span
            className="font-mono uppercase block mb-1.5"
            style={{ fontSize: "9px", letterSpacing: "0.28em", color: "rgba(201,148,58,0.65)" }}
          >
            Monday
          </span>
          <div className="pl-3" style={{ borderLeft: "1px solid rgba(201,148,58,0.28)" }}>
            <p className="text-sm leading-relaxed font-light" style={{ color: "rgba(255,255,255,0.78)" }}>
              {content}
              {streaming && (
                <span
                  className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse"
                  style={{ background: "rgba(201,148,58,0.9)" }}
                />
              )}
            </p>
          </div>
          {!streaming && onSpeak && (
            <button
              onClick={onSpeak}
              className="mt-2 ml-3 flex items-center gap-1.5 uppercase opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ fontSize: "9px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-geist-mono)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(201,148,58,0.7)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}
            >
              <Volume2 size={9} />
              Replay
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
