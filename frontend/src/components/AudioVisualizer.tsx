"use client";
import { useEffect, useRef } from "react";

interface Props {
  analyser: AnalyserNode | null;
  active: boolean;
}

type V3 = [number, number, number];
const rX = ([x, y, z]: V3, a: number): V3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rY = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rZ = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

export default function AudioVisualizer({ analyser, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 800, H = 800, CX = 400, CY = 400, R = 185;

    const g  = (a: number) => `rgba(210,148,32,${a.toFixed(3)})`;
    const gb = (a: number) => `rgba(255,198,60,${a.toFixed(3)})`;
    const gc = (a: number) => `rgba(255,238,135,${a.toFixed(3)})`;
    const wh = (a: number) => `rgba(255,255,255,${a.toFixed(3)})`;
    const lt = (a: number) => `rgba(180,220,255,${a.toFixed(3)})`;

    const proj = ([x, y, z]: V3): [number, number, number] => {
      const s = 1 + z / 1400;
      return [CX + x * s, CY + y * s, z];
    };

    // ── Gyroscope rings (5) ──────────────────────────────────────────
    const RINGS = [
      { tX: 0,              tZ: 0,              spd:  0.00021, r: R,          spN: 8, a: 0.80 },
      { tX: Math.PI / 2.1,  tZ: 0,              spd: -0.00032, r: R,          spN: 8, a: 0.65 },
      { tX: Math.PI / 3.5,  tZ: Math.PI / 2.8,  spd:  0.00040, r: R,          spN: 6, a: 0.52 },
      { tX: -Math.PI / 3.8, tZ: Math.PI / 4,    spd: -0.00025, r: R * 0.72,   spN: 0, a: 0.38 },
      { tX: Math.PI / 1.8,  tZ: Math.PI / 3.2,  spd:  0.00018, r: R * 1.20,   spN: 4, a: 0.28 },
    ];
    const rAngle = RINGS.map(() => Math.random() * Math.PI * 2);
    const tf = (p: V3, ri: number, gy: number): V3 =>
      rY(rZ(rX(p, RINGS[ri].tX), RINGS[ri].tZ), rAngle[ri] + gy);

    // ── Dyson arc bands (metal shell segments) ───────────────────────
    const ARC_N = 64;
    type CrackNode = { aOff: number; r: number; dy: number };
    type ShardVert = { aOff: number; r: number; dy: number };
    type ArcBand = {
      tX: number; tZ: number;
      angle: number; speed: number; span: number;
      innerR: number; outerR: number; al: number;
      noiseI: Float32Array; noiseO: Float32Array;
      cracks: CrackNode[][];
      shards: { verts: ShardVert[]; al: number }[];
      scratches: { aOff0: number; r0: number; aOff1: number; r1: number }[];
    };

    const mkNoise = (mag: number) =>
      Float32Array.from({ length: ARC_N + 1 }, () => (Math.random() - 0.5) * 2 * mag);

    const mkCracks = (span: number, iR: number, oR: number, n: number): CrackNode[][] =>
      Array.from({ length: n }, () => {
        let aOff = Math.random() * span, r = iR + Math.random() * (oR - iR) * 0.35;
        const pts: CrackNode[] = [];
        while (r < oR + 6) {
          pts.push({ aOff, r, dy: (Math.random() - 0.5) * 6 });
          r += 3 + Math.random() * 5; aOff += (Math.random() - 0.5) * 0.09;
        }
        return pts;
      });

    const mkShards = (span: number, iR: number, oR: number, n: number) =>
      Array.from({ length: n }, () => {
        const cA = (Math.random() - 0.1) * (span + 0.5), cr = oR + 9 + Math.random() * 30;
        const sz = 3 + Math.random() * 12;
        const nv = 3 + Math.floor(Math.random() * 3);
        const verts: ShardVert[] = Array.from({ length: nv }, (_, i) => {
          const pa = (i / nv) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
          const pr = sz * (0.5 + Math.random() * 0.8);
          return { aOff: cA + Math.cos(pa) * pr / cr, r: cr + Math.sin(pa) * pr * 0.5, dy: (Math.random() - 0.5) * 10 };
        });
        return { verts, al: 0.38 + Math.random() * 0.50 };
      });

    const mkScratches = (span: number, iR: number, oR: number, n: number) =>
      Array.from({ length: n }, () => {
        const a0 = 0.05 + Math.random() * (span - 0.1);
        return {
          aOff0: a0, r0: iR + Math.random() * (oR - iR),
          aOff1: a0 + (Math.random() - 0.5) * 0.22, r1: iR + Math.random() * (oR - iR),
        };
      });

    const mkBand = (tX: number, tZ: number, angle: number, speed: number, span: number, iR: number, oR: number, al: number): ArcBand => ({
      tX, tZ, angle, speed, span, innerR: iR, outerR: oR, al,
      noiseI: mkNoise(3.2), noiseO: mkNoise(4.8),
      cracks:   mkCracks(span, iR, oR, 5 + Math.floor(Math.random() * 3)),
      shards:   mkShards(span, iR, oR, 9 + Math.floor(Math.random() * 5)),
      scratches: mkScratches(span, iR, oR, 7 + Math.floor(Math.random() * 4)),
    });

    const BANDS: ArcBand[] = [
      mkBand(0.30, 0.15, 0,              0.00018,  Math.PI * 0.75, R + 10, R + 44, 0.88),
      mkBand(1.55, 0.85, Math.PI * 0.67, -0.00014, Math.PI * 0.72, R + 12, R + 47, 0.82),
      mkBand(2.62, 1.50, Math.PI * 1.33,  0.00020, Math.PI * 0.78, R + 8,  R + 42, 0.85),
    ];

    // ── Filaments ────────────────────────────────────────────────────
    type Fil = { pts: V3[]; life: number; max: number; al: number };
    const mkFil = (): Fil => {
      let phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
      const pts: V3[] = [];
      for (let i = 0; i <= 6 + Math.floor(Math.random() * 10); i++) {
        const r = R * (0.74 + Math.random() * 0.44);
        pts.push([Math.sin(phi)*Math.cos(theta)*r, Math.sin(phi)*Math.sin(theta)*r, Math.cos(phi)*r]);
        phi += (Math.random() - 0.5) * 0.58; theta += (Math.random() - 0.5) * 0.58;
      }
      return { pts, life: Math.random() * 30, max: 45 + Math.random() * 80, al: 0.45 + Math.random() * 0.55 };
    };

    // ── Surface crackle ──────────────────────────────────────────────
    type Crackle = { pts: V3[]; life: number; max: number };
    const mkCrackle = (): Crackle => {
      let phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
      const pts: V3[] = [];
      for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
        pts.push([Math.sin(phi)*Math.cos(theta)*R, Math.sin(phi)*Math.sin(theta)*R, Math.cos(phi)*R]);
        phi += (Math.random() - 0.5) * 0.35; theta += (Math.random() - 0.5) * 0.35;
      }
      return { pts, life: 0, max: 8 + Math.random() * 18 };
    };

    // ── Particles ────────────────────────────────────────────────────
    type Prt = { p: V3; v: V3; life: number; max: number; sz: number };
    const mkPrt = (): Prt => {
      const phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2;
      const r = R * (0.05 + Math.random() * 1.9);
      return {
        p: [Math.sin(phi)*Math.cos(theta)*r, Math.sin(phi)*Math.sin(theta)*r, Math.cos(phi)*r],
        v: [(Math.random()-0.5)*0.22, (Math.random()-0.5)*0.22, (Math.random()-0.5)*0.22],
        life: Math.random() * 80, max: 80 + Math.random() * 140, sz: 0.7 + Math.random() * 2.6,
      };
    };

    // ── Lightning arcs ────────────────────────────────────────────────
    type Lightning = { pts: [number, number][]; life: number; max: number; al: number };
    const mkLightning = (): Lightning => {
      const b1 = Math.acos(2 * Math.random() - 1), a1 = Math.random() * Math.PI * 2;
      const r1 = R * (0.85 + Math.random() * 0.30);
      const sx = Math.sin(b1)*Math.cos(a1)*r1 + CX, sy = Math.sin(b1)*Math.sin(a1)*r1 + CY;
      const b2 = b1 + (Math.random()-0.5)*1.4, a2 = a1 + (Math.random()-0.5)*2.0;
      const r2 = R * (0.7 + Math.random() * 0.65);
      const ex = Math.sin(b2)*Math.cos(a2)*r2 + CX, ey = Math.sin(b2)*Math.sin(a2)*r2 + CY;
      const steps = 10 + Math.floor(Math.random() * 8);
      const pts: [number, number][] = [[sx, sy]];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        pts.push([sx + (ex-sx)*t + (Math.random()-0.5)*38, sy + (ey-sy)*t + (Math.random()-0.5)*38]);
      }
      return { pts, life: 0, max: 5 + Math.floor(Math.random() * 7), al: 0.65 + Math.random() * 0.35 };
    };

    // ── Shockwaves ───────────────────────────────────────────────────
    type Shockwave = { r: number; speed: number; max: number; life: number; al: number };

    const fils      = Array.from({ length: 20  }, mkFil);
    const crackles  = Array.from({ length: 8   }, mkCrackle);
    const prts      = Array.from({ length: 150 }, mkPrt);
    const lightnings: Lightning[] = [];
    const shockwaves: Shockwave[] = [];
    const audioBuf  = new Uint8Array(analyser?.frequencyBinCount ?? 256);
    let frame = 0, gyAcc = 0, prevAmp = 0, scanAngle = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      frame++;
      ctx.clearRect(0, 0, W, H);

      let amp = 0;
      if (analyser && active) {
        analyser.getByteFrequencyData(audioBuf);
        amp = audioBuf.slice(0, 20).reduce((s, v) => s + v, 0) / (20 * 255);
      }

      const t = Date.now();
      const pulse = active
        ? 0.55 + 0.45 * Math.sin(t / 115) + amp * 0.30
        : 0.38 + 0.12 * Math.sin(t / 2400);

      gyAcc += active ? 0.0010 + amp * 0.0018 : 0.00030;
      const gy = gyAcc;

      // Spawn lightning on amplitude spikes + random
      if (active) {
        if (amp > 0.42 && prevAmp <= 0.42 && lightnings.length < 6) {
          lightnings.push(mkLightning());
          if (amp > 0.65) lightnings.push(mkLightning());
        }
        if (Math.random() < 0.018 && lightnings.length < 8) lightnings.push(mkLightning());
        // Shockwave on peaks
        if (amp > 0.55 && prevAmp <= 0.55 && shockwaves.length < 5)
          shockwaves.push({ r: R * 0.45, speed: 2.8 + amp * 3.5, max: 55, life: 0, al: 0.75 + amp * 0.25 });
      }
      prevAmp = amp;

      // ── Sphere edge bloom ──
      const edgeGlow = ctx.createRadialGradient(CX, CY, R * 0.75, CX, CY, R * 1.45);
      edgeGlow.addColorStop(0, g(0));
      edgeGlow.addColorStop(0.5, g(active ? 0.07 * pulse : 0.022));
      edgeGlow.addColorStop(1, g(0));
      ctx.beginPath(); ctx.arc(CX, CY, R * 1.45, 0, Math.PI * 2);
      ctx.fillStyle = edgeGlow; ctx.fill();

      // ── Idle scan beam ──
      if (!active) {
        scanAngle += 0.007;
        ctx.save();
        const span = Math.PI * 0.20;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.arc(CX, CY, R * 1.5, scanAngle, scanAngle + span);
        ctx.closePath();
        const sg = ctx.createRadialGradient(CX, CY, R * 0.4, CX, CY, R * 1.5);
        sg.addColorStop(0, g(0));
        sg.addColorStop(0.65, g(0.018));
        sg.addColorStop(1, g(0.048));
        ctx.fillStyle = sg; ctx.fill();
        // Leading edge
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(scanAngle + span) * R * 1.5, CY + Math.sin(scanAngle + span) * R * 1.5);
        ctx.strokeStyle = gb(0.20); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.restore();
      }

      // ── Dyson arc bands (dystopian metal) ──
      BANDS.forEach(band => {
        band.angle += active ? band.speed * (1 + amp * 4.0) : band.speed * 0.22;
        const xf  = (p: V3) => proj(rY(rZ(rX(p, band.tX), band.tZ), gy));
        const pt3 = (a: number, r: number, dy = 0): V3 => [Math.cos(a) * r, dy, Math.sin(a) * r];
        const pt  = (a: number, r: number, dy = 0) => xf(pt3(a, r, dy));

        const inner2d: [number, number, number][] = [];
        const outer2d: [number, number, number][] = [];
        for (let i = 0; i <= ARC_N; i++) {
          const a = band.angle + (i / ARC_N) * band.span;
          inner2d.push(xf(pt3(a, band.innerR + band.noiseI[i])));
          outer2d.push(xf(pt3(a, band.outerR + band.noiseO[i])));
        }

        const mid   = ARC_N >> 1;
        const avgZ  = (inner2d[mid][2] + outer2d[mid][2]) * 0.5;
        const depth = Math.max(0, Math.min(1, (avgZ + band.outerR + 20) / (band.outerR * 2 + 40)));
        const al    = band.al * (0.2 + 0.8 * depth) * (active ? pulse * 0.5 + 0.6 : 0.65);
        if (al < 0.05) return;

        const bandPath = () => {
          ctx.beginPath();
          ctx.moveTo(outer2d[0][0], outer2d[0][1]);
          for (let i = 1; i <= ARC_N; i++) ctx.lineTo(outer2d[i][0], outer2d[i][1]);
          for (let i = ARC_N; i >= 0; i--) ctx.lineTo(inner2d[i][0], inner2d[i][1]);
          ctx.closePath();
        };

        // Glow halo
        ctx.save();
        ctx.shadowBlur = active ? 42 + amp * 35 : 22;
        ctx.shadowColor = `rgba(170,60,8,${(al * (active ? 0.72 : 0.42)).toFixed(3)})`;
        bandPath();
        ctx.strokeStyle = `rgba(190,80,12,${(al * 0.28).toFixed(3)})`; ctx.lineWidth = 14; ctx.stroke();
        ctx.restore();

        // Dark metal fill + ember tint
        bandPath(); ctx.fillStyle = `rgba(9,4,1,${(al * 0.86).toFixed(3)})`; ctx.fill();
        bandPath(); ctx.fillStyle = `rgba(80,30,5,${(al * (active ? 0.20 + amp * 0.18 : 0.10)).toFixed(3)})`; ctx.fill();

        // Outer edge highlight
        ctx.beginPath(); ctx.moveTo(outer2d[0][0], outer2d[0][1]);
        for (let i = 1; i <= ARC_N; i++) ctx.lineTo(outer2d[i][0], outer2d[i][1]);
        ctx.strokeStyle = `rgba(195,110,35,${(al * 0.94).toFixed(3)})`; ctx.lineWidth = 2.6; ctx.stroke();

        // Inner edge rust shadow
        ctx.beginPath(); ctx.moveTo(inner2d[0][0], inner2d[0][1]);
        for (let i = 1; i <= ARC_N; i++) ctx.lineTo(inner2d[i][0], inner2d[i][1]);
        ctx.strokeStyle = `rgba(65,28,6,${(al * 0.82).toFixed(3)})`; ctx.lineWidth = 1.4; ctx.stroke();

        // End caps
        for (const i of [0, ARC_N]) {
          ctx.beginPath(); ctx.moveTo(outer2d[i][0], outer2d[i][1]); ctx.lineTo(inner2d[i][0], inner2d[i][1]);
          ctx.strokeStyle = `rgba(150,70,20,${(al * 0.72).toFixed(3)})`; ctx.lineWidth = 2.2; ctx.stroke();
        }

        // Radial struts
        [Math.floor(ARC_N * 0.25), Math.floor(ARC_N * 0.5), Math.floor(ARC_N * 0.75)].forEach(i => {
          ctx.beginPath(); ctx.moveTo(outer2d[i][0], outer2d[i][1]); ctx.lineTo(inner2d[i][0], inner2d[i][1]);
          ctx.strokeStyle = `rgba(90,42,10,${(al * 0.50).toFixed(3)})`; ctx.lineWidth = 1.0; ctx.stroke();
        });

        ctx.lineCap = "round";
        // Surface scratches
        band.scratches.forEach(s => {
          const [x0, y0] = pt(band.angle + s.aOff0, s.r0);
          const [x1, y1] = pt(band.angle + s.aOff1, s.r1);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
          ctx.strokeStyle = `rgba(40,18,5,${(al * 0.68).toFixed(3)})`; ctx.lineWidth = 0.8; ctx.stroke();
        });

        // Cracks — fissures with ember core
        band.cracks.forEach(crack => {
          const cPts = crack.map(n => pt(band.angle + n.aOff, n.r, n.dy));
          if (cPts.length < 2) return;
          ctx.save();
          ctx.shadowBlur = active ? 9 + amp * 14 : 4;
          ctx.shadowColor = `rgba(240,80,10,${(al * (active ? 0.80 : 0.50)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(cPts[0][0], cPts[0][1]);
          for (let i = 1; i < cPts.length; i++) ctx.lineTo(cPts[i][0], cPts[i][1]);
          ctx.strokeStyle = `rgba(5,2,0,${(al * 0.98).toFixed(3)})`; ctx.lineWidth = 2.2; ctx.stroke();
          ctx.restore();
          ctx.beginPath(); ctx.moveTo(cPts[0][0], cPts[0][1]);
          for (let i = 1; i < cPts.length; i++) ctx.lineTo(cPts[i][0], cPts[i][1]);
          ctx.strokeStyle = `rgba(220,85,15,${(al * (active ? 0.45 + amp * 0.35 : 0.28)).toFixed(3)})`; ctx.lineWidth = 0.6; ctx.stroke();
        });

        ctx.lineCap = "butt";
        // Debris shards
        band.shards.forEach(shard => {
          const sPts = shard.verts.map(v => pt(band.angle + v.aOff, v.r, v.dy));
          if (sPts.length < 3) return;
          const sDepth = Math.max(0, Math.min(1, (sPts[0][2] + band.outerR + 30) / (band.outerR * 2 + 60)));
          const sal = shard.al * (0.10 + 0.90 * sDepth) * (active ? pulse * 0.4 + 0.6 : 0.58);
          if (sal < 0.05) return;
          ctx.beginPath(); ctx.moveTo(sPts[0][0], sPts[0][1]);
          for (let i = 1; i < sPts.length; i++) ctx.lineTo(sPts[i][0], sPts[i][1]);
          ctx.closePath();
          ctx.fillStyle   = `rgba(7,3,1,${(sal * 0.72).toFixed(3)})`; ctx.fill();
          ctx.strokeStyle = `rgba(150,68,16,${(sal * 0.90).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.stroke();
        });
      });

      // ── Rings + spokes ──
      RINGS.forEach((ring, ri) => {
        rAngle[ri] += active ? ring.spd * (1 + amp * 2.8) : ring.spd * 0.38;
        const N = 80;
        const projected: [number, number, number][] = [];
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          projected.push(proj(tf([Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0], ri, gy)));
        }
        for (let i = 0; i < N; i++) {
          const [x1, y1, z1] = projected[i], [x2, y2, z2] = projected[i + 1];
          const depth = ((z1 + z2) / 2 + R) / (R * 2);
          const al = ring.a * (0.12 + 0.88 * depth) * (active ? pulse * 0.65 + 0.38 : 0.38);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.strokeStyle = gb(al); ctx.lineWidth = 1.8; ctx.stroke();
        }
        for (let si = 0; si < ring.spN; si++) {
          const a = (si / ring.spN) * Math.PI * 2;
          const [tx, ty, tz] = proj(tf([Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0], ri, gy));
          const depth = (tz + R) / (R * 2);
          const al = ring.a * 0.62 * (0.18 + 0.82 * depth) * (active ? pulse * 0.6 + 0.4 : 0.36);
          ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(tx, ty);
          ctx.strokeStyle = g(al); ctx.lineWidth = 1.1; ctx.stroke();
        }
      });

      // ── Filaments ──
      for (let fi = 0; fi < fils.length; fi++) {
        const f = fils[fi];
        f.life++;
        if (f.life > f.max) { fils[fi] = mkFil(); continue; }
        const fa = f.al * Math.sin((f.life / f.max) * Math.PI) * (active ? 0.88 : 0.40);
        const rPts = f.pts.map(p => proj(rY(p, gy)));
        ctx.beginPath(); ctx.moveTo(rPts[0][0], rPts[0][1]);
        for (let i = 1; i < rPts.length; i++) ctx.lineTo(rPts[i][0], rPts[i][1]);
        ctx.strokeStyle = gb(fa); ctx.lineWidth = 0.9 + fa * 1.2; ctx.lineCap = "round"; ctx.stroke();
      }
      if (frame % (active ? 5 : 12) === 0 && fils.length < 32) fils.push(mkFil());

      // ── Surface crackle ──
      for (let ci = 0; ci < crackles.length; ci++) {
        const c = crackles[ci];
        c.life++;
        if (c.life > c.max) { crackles[ci] = mkCrackle(); continue; }
        const ca = (1 - c.life / c.max) * (active ? 1.0 : 0.46);
        const rPts = c.pts.map(p => proj(rY(p, gy)));
        ctx.beginPath(); ctx.moveTo(rPts[0][0], rPts[0][1]);
        for (let i = 1; i < rPts.length; i++) ctx.lineTo(rPts[i][0], rPts[i][1]);
        ctx.strokeStyle = wh(ca * 0.75); ctx.lineWidth = 0.85; ctx.lineCap = "round"; ctx.stroke();
      }
      if (frame % (active ? 3 : 7) === 0 && crackles.length < 20) crackles.push(mkCrackle());

      // ── Particles ──
      prts.forEach(p => {
        p.life++;
        if (p.life > p.max) { Object.assign(p, { ...mkPrt(), life: 0 }); return; }
        if (active && amp > 0.28) { p.v[0] *= 1.008; p.v[1] *= 1.008; p.v[2] *= 1.008; }
        p.p[0] += p.v[0]; p.p[1] += p.v[1]; p.p[2] += p.v[2];
        const [px, py, pz] = proj(rY(p.p, gy));
        const depth = (pz + R) / (R * 2);
        const lr = Math.sin((p.life / p.max) * Math.PI);
        const pa = lr * (0.28 + 0.72 * depth) * (active ? 1.0 : 0.50);
        ctx.beginPath(); ctx.arc(px, py, p.sz * (0.4 + lr * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = pa > 0.55 ? wh(pa * 0.55) : gb(pa); ctx.fill();
      });

      // ── Lightning arcs ──
      for (let li = lightnings.length - 1; li >= 0; li--) {
        const lgt = lightnings[li];
        lgt.life++;
        if (lgt.life > lgt.max) { lightnings.splice(li, 1); continue; }
        const la = lgt.al * (1 - lgt.life / lgt.max);
        ctx.save();
        ctx.shadowBlur = 22; ctx.shadowColor = lt(la * 0.9);
        ctx.beginPath(); ctx.moveTo(lgt.pts[0][0], lgt.pts[0][1]);
        for (let i = 1; i < lgt.pts.length; i++) ctx.lineTo(lgt.pts[i][0], lgt.pts[i][1]);
        ctx.strokeStyle = lt(la * 0.45); ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(lgt.pts[0][0], lgt.pts[0][1]);
        for (let i = 1; i < lgt.pts.length; i++) ctx.lineTo(lgt.pts[i][0], lgt.pts[i][1]);
        ctx.strokeStyle = wh(la * 0.95); ctx.lineWidth = 1.3; ctx.stroke();
      }

      // ── Shockwaves ──
      for (let si = shockwaves.length - 1; si >= 0; si--) {
        const sw = shockwaves[si];
        sw.life++; sw.r += sw.speed;
        if (sw.life > sw.max || sw.r > W * 0.72) { shockwaves.splice(si, 1); continue; }
        const sa = sw.al * Math.pow(1 - sw.life / sw.max, 0.6);
        ctx.beginPath(); ctx.arc(CX, CY, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = gb(sa * 0.75); ctx.lineWidth = 2.8 * (1 - sw.life / sw.max); ctx.stroke();
        ctx.beginPath(); ctx.arc(CX, CY, sw.r * 1.06, 0, Math.PI * 2);
        ctx.strokeStyle = g(sa * 0.22); ctx.lineWidth = 10 * (1 - sw.life / sw.max); ctx.stroke();
      }

      // ── Core glow ──
      const cR = 32 + (active ? amp * 24 : 0);
      const cMult = active ? 5.2 : 4.0;
      const cGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, cR * cMult);
      cGrad.addColorStop(0,    wh(active ? 0.96 : 0.70));
      cGrad.addColorStop(0.07, gc(active ? 0.92 * pulse : 0.60));
      cGrad.addColorStop(0.20, gb(active ? 0.65 * pulse : 0.30));
      cGrad.addColorStop(0.48, g(active  ? 0.24 * pulse : 0.09));
      cGrad.addColorStop(1,    g(0));
      ctx.beginPath(); ctx.arc(CX, CY, cR * cMult, 0, Math.PI * 2); ctx.fillStyle = cGrad; ctx.fill();

      // Dashed orbit rings around core
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(t * 0.0022);
      ctx.setLineDash([5, 11]);
      ctx.beginPath(); ctx.arc(0, 0, cR * 1.7, 0, Math.PI * 2);
      ctx.strokeStyle = gb(0.54 * pulse); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.setLineDash([]); ctx.restore();

      ctx.save(); ctx.translate(CX, CY); ctx.rotate(-t * 0.0016);
      ctx.setLineDash([3, 16]);
      ctx.beginPath(); ctx.arc(0, 0, cR * 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = g(0.30 * pulse); ctx.lineWidth = 1.0; ctx.stroke();
      ctx.setLineDash([]); ctx.restore();

      ctx.beginPath(); ctx.arc(CX, CY, cR * 0.84, 0, Math.PI * 2);
      ctx.strokeStyle = gc(0.72 + pulse * 0.28); ctx.lineWidth = 2.2; ctx.stroke();

      const nGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 18);
      nGrad.addColorStop(0, wh(1)); nGrad.addColorStop(0.45, gc(0.92)); nGrad.addColorStop(1, gb(0));
      ctx.beginPath(); ctx.arc(CX, CY, 18, 0, Math.PI * 2); ctx.fillStyle = nGrad; ctx.fill();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      style={{
        width: 580,
        height: 580,
        filter:
          "drop-shadow(0 0 80px rgba(210,148,32,0.78)) " +
          "drop-shadow(0 0 180px rgba(160,100,10,0.35))",
      }}
    />
  );
}
