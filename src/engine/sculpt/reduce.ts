export interface ReduceOptions {
  target: number;
  importance: ArrayLike<number>;
  region: ArrayLike<number>;
  borderWeight: number;
  lengthWeight: number;
}

export interface ReducedMesh {
  positions: number[];
  faces: number[];
}

class CostHeap {
  private cost = new Float64Array(1024);
  private data = new Int32Array(4096);
  private count = 0;
  get size(): number { return this.count; }
  push(cost: number, u: number, v: number, su: number, sv: number): void {
    if (this.count === this.cost.length) {
      const cost = new Float64Array(this.count * 2); cost.set(this.cost); this.cost = cost;
      const data = new Int32Array(this.count * 8); data.set(this.data); this.data = data;
    }
    let i = this.count++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cost[p]! <= cost) break;
      this.move(p, i); i = p;
    }
    this.cost[i] = cost;
    this.data[i * 4] = u; this.data[i * 4 + 1] = v; this.data[i * 4 + 2] = su; this.data[i * 4 + 3] = sv;
  }
  pop(out: number[]): number {
    const top = this.cost[0]!;
    for (let k = 0; k < 4; k++) out[k] = this.data[k]!;
    const last = --this.count;
    const cost = this.cost[last]!;
    const u = this.data[last * 4]!, v = this.data[last * 4 + 1]!, su = this.data[last * 4 + 2]!, sv = this.data[last * 4 + 3]!;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      if (l >= last) break;
      const m = r < last && this.cost[r]! < this.cost[l]! ? r : l;
      if (this.cost[m]! >= cost) break;
      this.move(m, i); i = m;
    }
    this.cost[i] = cost;
    this.data[i * 4] = u; this.data[i * 4 + 1] = v; this.data[i * 4 + 2] = su; this.data[i * 4 + 3] = sv;
    return top;
  }
  private move(from: number, to: number): void {
    this.cost[to] = this.cost[from]!;
    for (let k = 0; k < 4; k++) this.data[to * 4 + k] = this.data[from * 4 + k]!;
  }
}

function addPlane(q: Float64Array, offset: number, a: number, b: number, c: number, d: number, w: number): void {
  q[offset] = q[offset]! + (w * a * a); q[offset + 1] = q[offset + 1]! + (w * a * b); q[offset + 2] = q[offset + 2]! + (w * a * c); q[offset + 3] = q[offset + 3]! + (w * a * d);
  q[offset + 4] = q[offset + 4]! + (w * b * b); q[offset + 5] = q[offset + 5]! + (w * b * c); q[offset + 6] = q[offset + 6]! + (w * b * d);
  q[offset + 7] = q[offset + 7]! + (w * c * c); q[offset + 8] = q[offset + 8]! + (w * c * d); q[offset + 9] = q[offset + 9]! + (w * d * d);
}

function quadricError(q: ArrayLike<number>, x: number, y: number, z: number): number {
  return q[0]! * x * x + 2 * q[1]! * x * y + 2 * q[2]! * x * z + 2 * q[3]! * x + q[4]! * y * y + 2 * q[5]! * y * z + 2 * q[6]! * y + q[7]! * z * z + 2 * q[8]! * z + q[9]!;
}

function triangleQuality(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): { nx: number, ny: number, nz: number, quality: number } {
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const area2 = Math.hypot(nx, ny, nz);
  const wx = cx - bx, wy = cy - by, wz = cz - bz;
  const sum = ux * ux + uy * uy + uz * uz + vx * vx + vy * vy + vz * vz + wx * wx + wy * wy + wz * wz;
  return { nx, ny, nz, quality: sum > 0 ? 2 * Math.sqrt(3) * area2 / sum : 0 };
}

export function reduceMesh(source: ReducedMesh, options: ReduceOptions): ReducedMesh {
  const n = source.positions.length / 3;
  const P = Float64Array.from(source.positions);
  const F = Int32Array.from(source.faces);
  const faceCount = F.length / 3;
  const alive = new Uint8Array(faceCount).fill(1);
  const dead = new Uint8Array(n);
  const stamp = new Int32Array(n);
  const vf: number[][] = Array.from({ length: n }, () => []);
  for (let f = 0; f < faceCount; f++) for (let e = 0; e < 3; e++) vf[F[f * 3 + e]!]!.push(f);
  const Q = new Float64Array(n * 10);
  const normal = (f: number) => {
    const a = F[f * 3]! * 3, b = F[f * 3 + 1]! * 3, c = F[f * 3 + 2]! * 3;
    return triangleQuality(P[a]!, P[a + 1]!, P[a + 2]!, P[b]!, P[b + 1]!, P[b + 2]!, P[c]!, P[c + 1]!, P[c + 2]!);
  };
  for (let f = 0; f < faceCount; f++) {
    const t = normal(f), length = Math.hypot(t.nx, t.ny, t.nz);
    if (length < 1e-20) continue;
    const a = F[f * 3]! * 3;
    const nx = t.nx / length, ny = t.ny / length, nz = t.nz / length, d = -(nx * P[a]! + ny * P[a + 1]! + nz * P[a + 2]!);
    for (let e = 0; e < 3; e++) addPlane(Q, F[f * 3 + e]! * 10, nx, ny, nz, d, length / 2);
  }
  const coded = new Float64Array(faceCount * 3);
  for (let f = 0; f < faceCount; f++) for (let e = 0; e < 3; e++) {
    const u = F[f * 3 + e]!, v = F[f * 3 + (e + 1) % 3]!;
    coded[f * 3 + e] = (Math.min(u, v) * n + Math.max(u, v)) * faceCount + f;
  }
  coded.sort();
  for (let i = 0; i + 1 < coded.length; i++) {
    const key = Math.floor(coded[i]! / faceCount);
    if (Math.floor(coded[i + 1]! / faceCount) !== key) continue;
    const list = [coded[i]! - key * faceCount, coded[i + 1]! - key * faceCount];
    i++;
    if (options.region[list[0]!] === options.region[list[1]!]) continue;
    const u = Math.floor(key / n), v = key % n;
    const ex = P[v * 3]! - P[u * 3]!, ey = P[v * 3 + 1]! - P[u * 3 + 1]!, ez = P[v * 3 + 2]! - P[u * 3 + 2]!;
    const length2 = ex * ex + ey * ey + ez * ez;
    for (const f of list) {
      const t = normal(f);
      let mx = ey * t.nz - ez * t.ny, my = ez * t.nx - ex * t.nz, mz = ex * t.ny - ey * t.nx;
      const m = Math.hypot(mx, my, mz);
      if (m < 1e-20) continue;
      mx /= m; my /= m; mz /= m;
      const d = -(mx * P[u * 3]! + my * P[u * 3 + 1]! + mz * P[u * 3 + 2]!);
      addPlane(Q, u * 10, mx, my, mz, d, options.borderWeight * length2);
      addPlane(Q, v * 10, mx, my, mz, d, options.borderWeight * length2);
    }
  }
  const importance = Float64Array.from({ length: n }, (_, v) => Math.max(1, options.importance[v] ?? 1));
  for (let v = 0; v < n; v++) for (let k = 0; k < 10; k++) Q[v * 10 + k] = Q[v * 10 + k]! * importance[v]!;
  const mark = new Int32Array(n);
  let generation = 0;
  const collect = (v: number, out: number[]) => {
    generation++;
    out.length = 0;
    for (const f of vf[v]!) if (alive[f]) for (let e = 0; e < 3; e++) {
      const w = F[f * 3 + e]!;
      if (w !== v && mark[w] !== generation) { mark[w] = generation; out.push(w); }
    }
    return out;
  };
  const degree = (v: number) => collect(v, scratch).length;
  const scratch: number[] = [];
  const aroundU: number[] = [], aroundV: number[] = [], aroundW: number[] = [];
  const neighbors = (v: number) => collect(v, aroundW).slice();
  const sum = new Float64Array(10);
  const best = { x: 0, y: 0, z: 0, error: 0 };
  const consider = (x: number, y: number, z: number) => {
    const error = quadricError(sum, x, y, z);
    if (error < best.error) { best.error = error; best.x = x; best.y = y; best.z = z; }
  };
  const plan = (u: number, v: number) => {
    for (let k = 0; k < 10; k++) sum[k] = Q[u * 10 + k]! + Q[v * 10 + k]!;
    const ux = P[u * 3]!, uy = P[u * 3 + 1]!, uz = P[u * 3 + 2]!, vx = P[v * 3]!, vy = P[v * 3 + 1]!, vz = P[v * 3 + 2]!;
    const length2 = (ux - vx) ** 2 + (uy - vy) ** 2 + (uz - vz) ** 2;
    best.error = Infinity;
    consider((ux + vx) / 2, (uy + vy) / 2, (uz + vz) / 2);
    consider(ux, uy, uz);
    consider(vx, vy, vz);
    const a = sum[0]!, b = sum[1]!, c = sum[2]!, e = sum[4]!, f = sum[5]!, h = sum[7]!;
    const det = a * (e * h - f * f) - b * (b * h - f * c) + c * (b * f - e * c);
    const scale = Math.abs(a) + Math.abs(e) + Math.abs(h);
    if (scale > 0 && Math.abs(det) > 1e-9 * scale * scale * scale) {
      const rx = -sum[3]!, ry = -sum[6]!, rz = -sum[8]!;
      const x = (rx * (e * h - f * f) - b * (ry * h - f * rz) + c * (ry * f - e * rz)) / det;
      const y = (a * (ry * h - f * rz) - rx * (b * h - f * c) + c * (b * rz - ry * c)) / det;
      const z = (a * (e * rz - ry * f) - b * (b * rz - ry * c) + rx * (b * f - e * c)) / det;
      const mx = (ux + vx) / 2, my = (uy + vy) / 2, mz = (uz + vz) / 2;
      if (Number.isFinite(x) && (x - mx) ** 2 + (y - my) ** 2 + (z - mz) ** 2 < length2) consider(x, y, z);
    }
    return Math.max(0, best.error) + options.lengthWeight * length2 * length2 * (importance[u]! + importance[v]!) * 0.5;
  };
  const markV = new Int32Array(n);
  let markGeneration = 0;
  const valid = (u: number, v: number, x: number, y: number, z: number) => {
    collect(u, aroundU);
    collect(v, aroundV);
    markGeneration++;
    for (const w of aroundV) markV[w] = markGeneration;
    let shared = 0;
    for (const w of aroundU) if (markV[w] === markGeneration) { shared++; if (degree(w) <= 3) return false; }
    if (shared !== 2) return false;
    if (aroundU.length + aroundV.length - 4 < 3) return false;
    let worstBefore = 1, worstAfter = 1;
    for (const side of [u, v]) for (const f of vf[side]!) {
      if (!alive[f]) continue;
      const a = F[f * 3]!, b = F[f * 3 + 1]!, c = F[f * 3 + 2]!;
      const before = normal(f);
      worstBefore = Math.min(worstBefore, before.quality);
      if ((a === u || b === u || c === u) && (a === v || b === v || c === v)) continue;
      const ax = a === side ? x : P[a * 3]!, ay = a === side ? y : P[a * 3 + 1]!, az = a === side ? z : P[a * 3 + 2]!;
      const bx = b === side ? x : P[b * 3]!, by = b === side ? y : P[b * 3 + 1]!, bz = b === side ? z : P[b * 3 + 2]!;
      const cx = c === side ? x : P[c * 3]!, cy = c === side ? y : P[c * 3 + 1]!, cz = c === side ? z : P[c * 3 + 2]!;
      const after = triangleQuality(ax, ay, az, bx, by, bz, cx, cy, cz);
      const lb = Math.hypot(before.nx, before.ny, before.nz), la = Math.hypot(after.nx, after.ny, after.nz);
      if (la < 1e-14) return false;
      if (lb > 1e-14 && (before.nx * after.nx + before.ny * after.ny + before.nz * after.nz) / (lb * la) < 0.25) return false;
      worstAfter = Math.min(worstAfter, after.quality);
    }
    return worstAfter >= 0.12 || worstAfter >= worstBefore;
  };
  let faces = faceCount;
  const entry = [0, 0, 0, 0];
  for (let round = 0; round < 8 && faces > options.target; round++) {
    const heap = new CostHeap();
    for (let f = 0; f < faceCount; f++) if (alive[f]) for (let e = 0; e < 3; e++) {
      const u = F[f * 3 + e]!, v = F[f * 3 + (e + 1) % 3]!;
      if (u < v) heap.push(plan(u, v), u, v, stamp[u]!, stamp[v]!);
    }
    const before = faces;
  while (faces > options.target && heap.size) {
    heap.pop(entry);
    const [u, v, su, sv] = entry as [number, number, number, number];
    if (dead[u] || dead[v] || stamp[u] !== su || stamp[v] !== sv) continue;
    plan(u, v);
    const x = best.x, y = best.y, z = best.z;
    if (!valid(u, v, x, y, z)) continue;
    P[u * 3] = x; P[u * 3 + 1] = y; P[u * 3 + 2] = z;
    for (let k = 0; k < 10; k++) Q[u * 10 + k] = Q[u * 10 + k]! + (Q[v * 10 + k]!);
    importance[u] = Math.max(importance[u]!, importance[v]!);
    for (const f of vf[v]!) {
      if (!alive[f]) continue;
      const slots = [F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!];
      if (slots.includes(u)) { alive[f] = 0; faces--; continue; }
      for (let e = 0; e < 3; e++) if (F[f * 3 + e] === v) F[f * 3 + e] = u;
      vf[u]!.push(f);
    }
    vf[v] = []; dead[v] = 1;
    vf[u] = vf[u]!.filter(f => alive[f]);
    stamp[u]!++;
    for (const w of neighbors(u)) {
      if (vf[w]!.length > 12) vf[w] = vf[w]!.filter(f => alive[f]);
      heap.push(plan(u, w), u, w, stamp[u]!, stamp[w]!);
    }
  }
    if (faces === before) break;
  }
  const remap = new Int32Array(n).fill(-1);
  const positions: number[] = [];
  const out: number[] = [];
  for (let f = 0; f < faceCount; f++) {
    if (!alive[f]) continue;
    for (let e = 0; e < 3; e++) {
      const v = F[f * 3 + e]!;
      if (remap[v] === -1) { remap[v] = positions.length / 3; positions.push(P[v * 3]!, P[v * 3 + 1]!, P[v * 3 + 2]!); }
      out.push(remap[v]!);
    }
  }
  return { positions, faces: out };
}

export function flipEdges(mesh: ReducedMesh, region: ArrayLike<number>, flatness: number, passes: number): ReducedMesh {
  const P = mesh.positions, F = mesh.faces.slice(), n = P.length / 3;
  const reg = Array.from(region);
  const angleAt = (a: number, b: number, c: number) => {
    const ux = P[b * 3]! - P[a * 3]!, uy = P[b * 3 + 1]! - P[a * 3 + 1]!, uz = P[b * 3 + 2]! - P[a * 3 + 2]!;
    const vx = P[c * 3]! - P[a * 3]!, vy = P[c * 3 + 1]! - P[a * 3 + 1]!, vz = P[c * 3 + 2]! - P[a * 3 + 2]!;
    return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) + 1e-30))));
  };
  const faceNormal = (a: number, b: number, c: number) => {
    const t = triangleQuality(P[a * 3]!, P[a * 3 + 1]!, P[a * 3 + 2]!, P[b * 3]!, P[b * 3 + 1]!, P[b * 3 + 2]!, P[c * 3]!, P[c * 3 + 1]!, P[c * 3 + 2]!);
    const l = Math.hypot(t.nx, t.ny, t.nz) || 1;
    return [t.nx / l, t.ny / l, t.nz / l] as const;
  };
  for (let pass = 0; pass < passes; pass++) {
    const edges = new Map<number, number[]>();
    for (let f = 0; f < F.length / 3; f++) for (let e = 0; e < 3; e++) {
      const u = F[f * 3 + e]!, v = F[f * 3 + (e + 1) % 3]!;
      const key = Math.min(u, v) * n + Math.max(u, v);
      const list = edges.get(key);
      if (list) list.push(f); else edges.set(key, [f]);
    }
    const touched = new Uint8Array(F.length / 3);
    let flipped = 0;
    for (const [key, list] of edges) {
      if (list.length !== 2) continue;
      const [f1, f2] = list as [number, number];
      if (touched[f1] || touched[f2] || reg[f1] !== reg[f2]) continue;
      const u = Math.floor(key / n), v = key % n;
      const rotate = (f: number) => {
        const tri = [F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!];
        while (!(tri[0] === u && (tri[1] === v)) && !(tri[0] === v && tri[1] === u)) tri.push(tri.shift()!);
        return tri as [number, number, number];
      };
      const t1 = rotate(f1), t2 = rotate(f2);
      const a = t1[0], b = t1[1], c = t1[2], d = t2[2];
      if (t2[0] !== b || t2[1] !== a || c === d) continue;
      if (edges.has(Math.min(c, d) * n + Math.max(c, d))) continue;
      const n1 = faceNormal(a, b, c), n2 = faceNormal(b, a, d);
      if (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] < flatness) continue;
      if (angleAt(c, a, b) + angleAt(d, a, b) <= Math.PI + 1e-6) continue;
      const m1 = faceNormal(a, d, c), m2 = faceNormal(d, b, c);
      const avg = [n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]];
      if (m1[0] * avg[0]! + m1[1] * avg[1]! + m1[2] * avg[2]! < 0.9 || m2[0] * avg[0]! + m2[1] * avg[1]! + m2[2] * avg[2]! < 0.9) continue;
      F[f1 * 3] = a; F[f1 * 3 + 1] = d; F[f1 * 3 + 2] = c;
      F[f2 * 3] = d; F[f2 * 3 + 1] = b; F[f2 * 3 + 2] = c;
      touched[f1] = 1; touched[f2] = 1; flipped++;
    }
    if (!flipped) break;
  }
  return { positions: P, faces: F };
}


