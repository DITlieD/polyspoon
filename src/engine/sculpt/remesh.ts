import { Vector3 } from 'three';
import type { SculptField } from './field.ts';
import type { ReducedMesh } from './reduce.ts';
import { settleRound } from './relax.ts';

interface Topology { edges: Map<number, number[]>, around: number[][] }

function link(F: number[], vertexCount: number): Topology {
  const edges = new Map<number, number[]>();
  const around: number[][] = Array.from({ length: vertexCount }, () => []);
  for (let f = 0; f < F.length / 3; f++) {
    if (F[f * 3]! < 0) continue;
    for (let e = 0; e < 3; e++) {
      const u = F[f * 3 + e]!, v = F[f * 3 + (e + 1) % 3]!;
      const key = Math.min(u, v) * vertexCount + Math.max(u, v);
      const list = edges.get(key);
      if (list) list.push(f); else edges.set(key, [f]);
      around[u]!.push(f);
    }
  }
  return { edges, around };
}

function opposite(F: number[], f: number, u: number, v: number): number {
  for (let e = 0; e < 3; e++) { const w = F[f * 3 + e]!; if (w !== u && w !== v) return w; }
  return -1;
}

function forward(F: number[], f: number, u: number, v: number): boolean {
  for (let e = 0; e < 3; e++) if (F[f * 3 + e] === u && F[f * 3 + (e + 1) % 3] === v) return true;
  return false;
}

function normalOf(P: number[], a: number, b: number, c: number, out = new Vector3()): Vector3 {
  const ux = P[b * 3]! - P[a * 3]!, uy = P[b * 3 + 1]! - P[a * 3 + 1]!, uz = P[b * 3 + 2]! - P[a * 3 + 2]!;
  const vx = P[c * 3]! - P[a * 3]!, vy = P[c * 3 + 1]! - P[a * 3 + 1]!, vz = P[c * 3 + 2]! - P[a * 3 + 2]!;
  return out.set(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function distance(P: number[], a: number, b: number): number {
  return Math.hypot(P[a * 3]! - P[b * 3]!, P[a * 3 + 1]! - P[b * 3 + 1]!, P[a * 3 + 2]! - P[b * 3 + 2]!);
}

class Remesher {
  P: number[];
  F: number[];
  size: number[] = [];
  private readonly point = new Vector3();
  constructor(mesh: ReducedMesh, private readonly field: SculptField, private readonly cell: number) {
    this.P = mesh.positions.slice();
    this.F = mesh.faces.slice();
  }
  get faceCount(): number { return this.F.length / 3; }
  outline(v: number): number {
    const tolerance = (this.size[v] ?? this.cell) * 0.12;
    let best = -1, nearest = tolerance;
    this.field.overlays.forEach((overlay, index) => {
      const d = Math.abs(overlay.distance(this.P[v * 3]!, this.P[v * 3 + 1]!, this.P[v * 3 + 2]!));
      if (d < nearest) { nearest = d; best = index; }
    });
    return best;
  }
  private normals(): Float64Array {
    const { P, F } = this, out = new Float64Array(P.length);
    const scratch = new Vector3();
    for (let f = 0; f < F.length / 3; f++) {
      if (F[f * 3]! < 0) continue;
      normalOf(P, F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!, scratch);
      for (let e = 0; e < 3; e++) { const v = F[f * 3 + e]!; out[v * 3] = out[v * 3]! + scratch.x; out[v * 3 + 1] = out[v * 3 + 1]! + scratch.y; out[v * 3 + 2] = out[v * 3 + 2]! + scratch.z; }
    }
    for (let v = 0; v < P.length / 3; v++) {
      const l = Math.hypot(out[v * 3]!, out[v * 3 + 1]!, out[v * 3 + 2]!) || 1;
      out[v * 3] = out[v * 3]! / l; out[v * 3 + 1] = out[v * 3 + 1]! / l; out[v * 3 + 2] = out[v * 3 + 2]! / l;
    }
    return out;
  }
  private flatness(normal: Float64Array): Float64Array {
    const { P, F } = this, out = new Float64Array(P.length / 3).fill(1), face = new Vector3();
    for (let f = 0; f < F.length / 3; f++) {
      if (F[f * 3]! < 0) continue;
      normalOf(P, F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!, face);
      if (face.lengthSq() < 1e-24) continue;
      face.normalize();
      for (let e = 0; e < 3; e++) {
        const v = F[f * 3 + e]!;
        out[v] = Math.min(out[v]!, face.x * normal[v * 3]! + face.y * normal[v * 3 + 1]! + face.z * normal[v * 3 + 2]!);
      }
    }
    return out;
  }
  crossings(): number {
    const { P, F } = this, n = P.length / 3, topo = link(F, n);
    const overlays = this.field.overlays;
    if (!overlays.length) return 0;
    const touched = new Set<number>();
    const a = new Vector3(), b = new Vector3();
    let done = 0;
    for (const [key, list] of topo.edges) {
      if (list.length !== 2) continue;
      const [f1, f2] = list as [number, number];
      if (touched.has(f1) || touched.has(f2)) continue;
      let u = Math.floor(key / n), v = key % n;
      if (this.outline(u) >= 0 || this.outline(v) >= 0) continue;
      a.set(P[u * 3]!, P[u * 3 + 1]!, P[u * 3 + 2]!); b.set(P[v * 3]!, P[v * 3 + 1]!, P[v * 3 + 2]!);
      const cut = overlays.find(overlay => (overlay.distance(a.x, a.y, a.z) < 0) !== (overlay.distance(b.x, b.y, b.z) < 0));
      if (!cut) continue;
      let lo = 0, hi = 1;
      const inside = cut.distance(a.x, a.y, a.z) < 0;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        this.point.copy(a).lerp(b, mid);
        if ((cut.distance(this.point.x, this.point.y, this.point.z) < 0) === inside) lo = mid; else hi = mid;
      }
      const t = (lo + hi) / 2;
      if (t < 0.12 || t > 0.88) continue;
      if (!forward(F, f1, u, v)) [u, v] = [v, u];
      const c = opposite(F, f1, u, v), d = opposite(F, f2, u, v);
      this.point.copy(a).lerp(b, t);
      this.field.project(this.point, this.cell * 0.25, this.cell);
      const m = P.length / 3;
      P.push(this.point.x, this.point.y, this.point.z);
      this.size[m] = (this.size[u]! + this.size[v]!) / 2;
      F[f1 * 3] = u; F[f1 * 3 + 1] = m; F[f1 * 3 + 2] = c;
      F[f2 * 3] = v; F[f2 * 3 + 1] = m; F[f2 * 3 + 2] = d;
      F.push(m, v, c, m, u, d);
      touched.add(f1); touched.add(f2);
      done++;
    }
    return done;
  }
  detailAt(v: number): number { return Math.max(1, this.field.ownerAt(this.P[v * 3]!, this.P[v * 3 + 1]!, this.P[v * 3 + 2]!).detail); }
  sizing(base: number): void {
    const n = this.P.length / 3, topo = link(this.F, n);
    this.size = Array.from({ length: n }, (_, v) => topo.around[v]!.length ? base / Math.sqrt(this.detailAt(v)) : base);
    for (let pass = 0; pass < 4; pass++) for (const key of topo.edges.keys()) {
      const u = Math.floor(key / n), v = key % n, d = distance(this.P, u, v);
      if (this.size[u]! > this.size[v]! + d * 0.35) this.size[u] = this.size[v]! + d * 0.35;
      if (this.size[v]! > this.size[u]! + d * 0.35) this.size[v] = this.size[u]! + d * 0.35;
    }
  }
  private ratio(u: number, v: number): number { return distance(this.P, u, v) / ((this.size[u]! + this.size[v]!) / 2); }
  split(threshold: number, limit: number): number {
    const { P, F } = this, n = P.length / 3, topo = link(F, n);
    const long = [...topo.edges.entries()].filter(([key, list]) => list.length === 2 && this.ratio(Math.floor(key / n), key % n) > threshold)
      .sort((x, y) => this.ratio(Math.floor(y[0] / n), y[0] % n) - this.ratio(Math.floor(x[0] / n), x[0] % n));
    const touched = new Set<number>();
    let done = 0;
    for (const [key, list] of long) {
      if (done >= limit) break;
      const [f1, f2] = list as [number, number];
      if (touched.has(f1) || touched.has(f2)) continue;
      let u = Math.floor(key / n), v = key % n;
      if (!forward(F, f1, u, v)) [u, v] = [v, u];
      const c = opposite(F, f1, u, v), d = opposite(F, f2, u, v);
      this.point.set((P[u * 3]! + P[v * 3]!) / 2, (P[u * 3 + 1]! + P[v * 3 + 1]!) / 2, (P[u * 3 + 2]! + P[v * 3 + 2]!) / 2);
      this.field.project(this.point, this.cell * 0.25, this.cell);
      const m = P.length / 3;
      P.push(this.point.x, this.point.y, this.point.z);
      this.size[m] = (this.size[u]! + this.size[v]!) / 2;
      F[f1 * 3] = u; F[f1 * 3 + 1] = m; F[f1 * 3 + 2] = c;
      F[f2 * 3] = v; F[f2 * 3 + 1] = m; F[f2 * 3 + 2] = d;
      F.push(m, v, c, m, u, d);
      touched.add(f1); touched.add(f2);
      done++;
    }
    return done;
  }
  collapse(threshold: number, limit: number, forced?: Set<number>): number {
    const { P, F } = this, n = P.length / 3, topo = link(F, n);
    const dead = new Uint8Array(n), busy = new Uint8Array(n);
    const normal = this.normals();
    const flat = this.flatness(normal);
    const ring = (v: number) => { const set = new Set<number>(); for (const f of topo.around[v]!) if (F[f * 3]! >= 0) for (let e = 0; e < 3; e++) { const w = F[f * 3 + e]!; if (w !== v) set.add(w); } return set; };
    const short = [...topo.edges.entries()].filter(([key, list]) => list.length === 2 && (forced ? forced.has(key) : this.ratio(Math.floor(key / n), key % n) < threshold))
      .sort((x, y) => this.ratio(Math.floor(x[0] / n), x[0] % n) - this.ratio(Math.floor(y[0] / n), y[0] % n));
    let done = 0;
    for (const [key] of short) {
      if (done >= limit) break;
      const u = Math.floor(key / n), v = key % n;
      if (dead[u] || dead[v] || busy[u] || busy[v]) continue;
      if (!forced && this.outline(u) !== this.outline(v)) continue;
      const bend = normal[u * 3]! * normal[v * 3]! + normal[u * 3 + 1]! * normal[v * 3 + 1]! + normal[u * 3 + 2]! * normal[v * 3 + 2]!;
      if (!forced && bend < 0.64 && this.ratio(u, v) > 0.3) continue;
      const ru = ring(u), rv = ring(v);
      let shared = 0, thin = false;
      for (const w of ru) if (rv.has(w)) { shared++; if (ring(w).size <= 3) thin = true; }
      if (shared !== 2 || thin || ru.size + rv.size - 4 < 3) continue;
      const sharper = flat[u]! < flat[v]! ? u : v;
      if (!forced && flat[sharper]! < 0.3) {
        const keep = sharper;
        this.point.set(P[keep * 3]!, P[keep * 3 + 1]!, P[keep * 3 + 2]!);
      } else {
        this.point.set((P[u * 3]! + P[v * 3]!) / 2, (P[u * 3 + 1]! + P[v * 3 + 1]!) / 2, (P[u * 3 + 2]! + P[v * 3 + 2]!) / 2);
        this.field.project(this.point, this.cell * 0.25, this.cell);
      }
      const reach = (this.size[u]! + this.size[v]!) / 2 * 4 / 3;
      let ok = true;
      for (const w of [...ru, ...rv]) if (w !== u && w !== v && Math.hypot(this.point.x - P[w * 3]!, this.point.y - P[w * 3 + 1]!, this.point.z - P[w * 3 + 2]!) > reach * Math.max(1, threshold)) { ok = false; break; }
      if (!ok) continue;
      const kept = P.slice(u * 3, u * 3 + 3);
      const faces = [...new Set([...topo.around[u]!, ...topo.around[v]!])].filter(f => F[f * 3]! >= 0);
      const old = faces.map(f => normalOf(P, F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!).normalize());
      P[u * 3] = this.point.x; P[u * 3 + 1] = this.point.y; P[u * 3 + 2] = this.point.z;
      for (let i = 0; i < faces.length && ok && !forced; i++) {
        const f = faces[i]!, tri = [F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!];
        if (tri.includes(u) && tri.includes(v)) continue;
        const swapped = tri.map(w => w === v ? u : w) as [number, number, number];
        const now = normalOf(P, swapped[0], swapped[1], swapped[2]);
        if (now.lengthSq() < 1e-20 || now.normalize().dot(old[i]!) < 0.4) ok = false;
      }
      if (!ok) { P[u * 3] = kept[0]!; P[u * 3 + 1] = kept[1]!; P[u * 3 + 2] = kept[2]!; continue; }
      for (const f of faces) {
        const tri = [F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!];
        if (tri.includes(u) && tri.includes(v)) { F[f * 3] = -1; F[f * 3 + 1] = -1; F[f * 3 + 2] = -1; continue; }
        for (let e = 0; e < 3; e++) if (F[f * 3 + e] === v) F[f * 3 + e] = u;
        topo.around[u]!.push(f);
      }
      dead[v] = 1; busy[u] = 1;
      for (const w of ru) busy[w] = 1;
      for (const w of rv) busy[w] = 1;
      done++;
    }
    this.F = F.filter((_, i) => F[i - (i % 3)]! >= 0);
    return done;
  }
  flip(): void {
    const { P, F } = this, n = P.length / 3, topo = link(F, n);
    const valence = new Int32Array(n);
    for (const key of topo.edges.keys()) { const a = Math.floor(key / n), b = key % n; valence[a] = valence[a]! + 1; valence[b] = valence[b]! + 1; }
    const flipped = new Set<number>();
    for (const [key, list] of topo.edges) {
      if (list.length !== 2) continue;
      const [f1, f2] = list as [number, number];
      if (flipped.has(f1) || flipped.has(f2)) continue;
      let u = Math.floor(key / n), v = key % n;
      if (!forward(F, f1, u, v)) [u, v] = [v, u];
      const c = opposite(F, f1, u, v), d = opposite(F, f2, u, v);
      if (c === d || topo.edges.has(Math.min(c, d) * n + Math.max(c, d))) continue;
      const line = this.outline(u);
      if (line >= 0 && line === this.outline(v)) continue;
      if (valence[u]! <= 3 || valence[v]! <= 3) continue;
      const before = Math.abs(valence[u]! - 6) + Math.abs(valence[v]! - 6) + Math.abs(valence[c]! - 6) + Math.abs(valence[d]! - 6);
      const after = Math.abs(valence[u]! - 7) + Math.abs(valence[v]! - 7) + Math.abs(valence[c]! - 5) + Math.abs(valence[d]! - 5);
      const n1 = normalOf(P, u, v, c).normalize(), n2 = normalOf(P, v, u, d).normalize();
      if (after >= before && n1.dot(n2) > 0.9) continue;
      const kept = this.gap(u, v), swapped = this.gap(c, d);
      const m1 = normalOf(P, u, d, c), m2 = normalOf(P, d, v, c);
      if (m1.lengthSq() < 1e-20 || m2.lengthSq() < 1e-20) continue;
      if (m1.normalize().dot(this.outward(u, d, c)) < 0.3 || m2.normalize().dot(this.outward(d, v, c)) < 0.3) continue;
      const truer = swapped < kept * 0.6 - this.cell * 0.01;
      if (!truer) {
        if (after >= before || swapped > kept * 1.25 + this.cell * 0.02) continue;
        if (n1.dot(n2) < 0.75) continue;
      }
      F[f1 * 3] = u; F[f1 * 3 + 1] = d; F[f1 * 3 + 2] = c;
      F[f2 * 3] = d; F[f2 * 3 + 1] = v; F[f2 * 3 + 2] = c;
      valence[u] = valence[u]! - 1; valence[v] = valence[v]! - 1; valence[c] = valence[c]! + 1; valence[d] = valence[d]! + 1;
      flipped.add(f1); flipped.add(f2);
      topo.edges.set(Math.min(c, d) * n + Math.max(c, d), [f1, f2]);
    }
  }
  private gap(a: number, b: number): number {
    const P = this.P;
    return Math.abs(this.field.value((P[a * 3]! + P[b * 3]!) / 2, (P[a * 3 + 1]! + P[b * 3 + 1]!) / 2, (P[a * 3 + 2]! + P[b * 3 + 2]!) / 2));
  }
  private outward(a: number, b: number, c: number): Vector3 {
    const P = this.P;
    return this.field.gradient((P[a * 3]! + P[b * 3]! + P[c * 3]!) / 3, (P[a * 3 + 1]! + P[b * 3 + 1]! + P[c * 3 + 1]!) / 3, (P[a * 3 + 2]! + P[b * 3 + 2]! + P[c * 3 + 2]!) / 3, this.cell * 0.25, new Vector3());
  }
  slivers(): Set<number> {
    const { P, F } = this, n = P.length / 3, out = new Set<number>();
    for (let f = 0; f < F.length / 3; f++) {
      const a = F[f * 3]!, b = F[f * 3 + 1]!, c = F[f * 3 + 2]!;
      const ab = distance(P, a, b), bc = distance(P, b, c), ca = distance(P, c, a);
      const area = normalOf(P, a, b, c).length() / 2;
      if (area > 0.02 * (ab * ab + bc * bc + ca * ca) && area > 1e-12) continue;
      const [u, v] = ab <= bc && ab <= ca ? [a, b] : bc <= ca ? [b, c] : [c, a];
      out.add(Math.min(u, v) * n + Math.max(u, v));
    }
    return out;
  }
  settle(): void {
    const settled = settleRound(this.P, this.F, this.field, this.cell);
    for (let i = 0; i < this.P.length; i++) this.P[i] = settled[i]!;
  }
  compact(): ReducedMesh {
    const remap = new Int32Array(this.P.length / 3).fill(-1);
    const positions: number[] = [];
    const faces = this.F.map(v => {
      if (remap[v] === -1) { remap[v] = positions.length / 3; positions.push(this.P[v * 3]!, this.P[v * 3 + 1]!, this.P[v * 3 + 2]!); }
      return remap[v]!;
    });
    return { positions, faces };
  }
}

export function remeshSurface(mesh: ReducedMesh, field: SculptField, cell: number, target: number, rounds: number): ReducedMesh {
  const work = new Remesher(mesh, field, cell);
  let weighted = 0;
  for (let f = 0; f < work.faceCount; f++) {
    const a = work.F[f * 3]!, b = work.F[f * 3 + 1]!, c = work.F[f * 3 + 2]!;
    weighted += normalOf(work.P, a, b, c).length() / 2 * (work.detailAt(a) + work.detailAt(b) + work.detailAt(c)) / 3;
  }
  let base = Math.sqrt(weighted / (0.433 * target * 1.6));
  for (let round = 0; round < rounds; round++) {
    work.sizing(base);
    work.split(4 / 3, Infinity);
    work.collapse(4 / 5, Infinity);
    work.crossings();
    work.flip();
    work.settle();
    if (round === 2) base *= Math.sqrt(work.faceCount / target);
  }
  for (let pass = 0; pass < 12 && work.faceCount !== target; pass++) {
    work.sizing(base);
    const gap = Math.abs(work.faceCount - target) / 2;
    if (work.faceCount > target) work.collapse(Infinity, gap);
    else work.split(0, gap);
    work.flip();
  }
  for (let round = 0; round < 2; round++) { work.crossings(); work.flip(); work.settle(); }
  for (let pass = 0; pass < 6; pass++) {
    const slivers = work.slivers();
    if (!slivers.size) break;
    work.collapse(Infinity, Infinity, slivers);
    work.flip();
  }
  return work.compact();
}





