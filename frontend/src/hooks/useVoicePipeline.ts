"use client";
import { useRef, useState, useCallback, useEffect } from "react";

export type VoiceState = "disconnected" | "idle" | "listening" | "processing";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/voice";
const PROCESSOR_BUFFER = 4096; // must be power-of-2; backend re-chunks for openWakeWord

export function useVoicePipeline(
  onTranscript: (text: string) => void,
  onWake?: () => void,
) {
  const [state, setState] = useState<VoiceState>("disconnected");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Always-current refs so WebSocket closure never goes stale
  const onTranscriptRef = useRef(onTranscript);
  const onWakeRef = useRef(onWake);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const disconnect = useCallback(() => {
    processorRef.current?.disconnect();
    ctxRef.current?.close();
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    processorRef.current = null;
    ctxRef.current = null;
    wsRef.current = null;
    streamRef.current = null;
    setAnalyser(null);
    setState("disconnected");
  }, []);

  // Must be called from a user-gesture handler (button click) for mic permission
  const connect = useCallback(async () => {
    if (state !== "disconnected") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Request 16kHz so PCM matches what openWakeWord expects
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      src.connect(analyserNode);
      setAnalyser(analyserNode);

      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => setState("idle");
      ws.onclose = () => disconnect();
      ws.onerror = () => disconnect();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "wake") {
          setState("listening");
          onWakeRef.current?.();
        } else if (msg.type === "transcript") {
          setState("processing");
          onTranscriptRef.current(msg.text as string);
          setState("idle");
        } else {
          setState("idle");
        }
      };

      // 4096-sample chunks (256ms at 16kHz) — backend re-chunks into 1280-sample windows
      const processor = ctx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
        }
        ws.send(i16.buffer);
      };

      // Silent destination avoids mic-through-speaker feedback
      const dest = ctx.createMediaStreamDestination();
      src.connect(processor);
      processor.connect(dest);
      processorRef.current = processor;
    } catch (err) {
      console.error("[useVoicePipeline] connect failed:", err);
      disconnect();
    }
  }, [state, disconnect]);

  return { state, analyser, connect };
}
