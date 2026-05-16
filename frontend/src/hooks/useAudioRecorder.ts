"use client";
import { useRef, useState, useCallback } from "react";

export type RecorderState = "idle" | "recording" | "processing";

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buf);
  const write = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

async function webmToWav(blob: Blob): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, 1, 16000);
  const arrayBuf = await blob.arrayBuffer();
  const decoded = await new AudioContext().decodeAudioData(arrayBuf);

  const length = Math.ceil(decoded.duration * 16000);
  const offline = new OfflineAudioContext(1, length, 16000);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), 16000);
}

export function useAudioRecorder(onTranscript: (text: string) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const node = ctx.createAnalyser();
    node.fftSize = 256;
    src.connect(node);
    audioCtxRef.current = ctx;
    setAnalyser(node);

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      setState("processing");
      const webm = new Blob(chunksRef.current, { type: "audio/webm" });
      try {
        const wav = await webmToWav(webm);
        const { transcribeAudio } = await import("@/lib/api");
        const text = await transcribeAudio(wav);
        if (text) onTranscript(text);
      } catch (e) {
        console.error("transcribe error", e);
      }
      setState("idle");
      setAnalyser(null);
      ctx.close();
    };
    recorder.start();
    mediaRef.current = recorder;
    setState("recording");
  }, [onTranscript]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  return { state, analyser, start, stop };
}
