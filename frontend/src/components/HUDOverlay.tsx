"use client";

export default function HUDOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[
        { cls: "top-5 left-5", t: true, l: true },
        { cls: "top-5 right-5", t: true, r: true },
        { cls: "bottom-5 left-5", b: true, l: true },
        { cls: "bottom-5 right-5", b: true, r: true },
      ].map(({ cls, t, r, b, l }, i) => (
        <div
          key={i}
          className={`absolute ${cls} w-5 h-5`}
          style={{
            borderTop: t ? "1px solid rgba(201,148,58,0.2)" : undefined,
            borderBottom: b ? "1px solid rgba(201,148,58,0.2)" : undefined,
            borderLeft: l ? "1px solid rgba(201,148,58,0.2)" : undefined,
            borderRight: r ? "1px solid rgba(201,148,58,0.2)" : undefined,
          }}
        />
      ))}
    </div>
  );
}
