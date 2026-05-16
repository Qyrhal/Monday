"use client";
import dynamic from "next/dynamic";
import HUDOverlay from "@/components/HUDOverlay";

const ChatInterface = dynamic(() => import("@/components/ChatInterface"), { ssr: false });

export default function Home() {
  return (
    <main className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <HUDOverlay />
      <div className="relative z-10 w-full">
        <ChatInterface />
      </div>
    </main>
  );
}
