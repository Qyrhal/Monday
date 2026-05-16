const BASE = "/api/proxy";

export type Message = { role: "user" | "assistant"; content: string };

export async function sendMessage(
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: () => void
) {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "monday", messages, stream: true }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { onDone(); return; }
      try {
        const data = JSON.parse(payload);
        const chunk = data.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch {}
    }
  }
  onDone();
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, blob.type.includes("wav") ? "audio.wav" : "audio.webm");
  const res = await fetch(`${BASE}/v1/audio/transcriptions`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  return data.text ?? "";
}

export async function synthesizeSpeech(text: string, voice: string = "M1"): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: text, voice }),
  });
  return res.arrayBuffer();
}

export async function fetchVoices(): Promise<string[]> {
  const res = await fetch(`${BASE}/v1/voices`);
  const data = await res.json();
  return data.voices ?? [];
}
