import { Vector3 } from 'three';
import type { SculptField, SculptShape } from './field.ts';
import type { ReducedMesh } from './reduce.ts';

export interface SculptDecalRing {
  shape: SculptShape;
  radius: number;
}

export interface SculptDecal {
  label: string;
  center: Vector3;
  axis: Vector3;
  right: Vector3;
  up: Vector3;
  stretch: number;
  segments: number;
  rings: SculptDecalRing[];
}

function zipper(faces: number[], outer: number[], inner: number[], angle: (v: number) => number): void {
  const base = angle(outer[0]!);
  const turn = (v: number) => { let a = angle(v) - base; while (a < 0) a += Math.PI * 2; while (a >= Math.PI * 2) a -= Math.PI * 2; return a; };
  let start = 0;
  for (let j = 1; j < inner.length; j++) if (turn(inner[j]!) < turn(inner[start]!)) start = j;
  const M = outer.length, S = inner.length;
  const sweep = [0];
  for (let i = 1; i <= M; i++) {
    let delta = angle(outer[i % M]!) - angle(outer[i - 1]!);
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    sweep.push(sweep[i - 1]! + delta);
  }
  const total = sweep[M]!;
  for (let i = 1; i <= M; i++) sweep[i] = Math.max(sweep[i - 1]!, sweep[i]! * Math.PI * 2 / total);
  const outerAt = (i: number) => sweep[Math.min(i, M)]!;
  const innerAt = (j: number) => j >= S ? Math.PI * 2 + turn(inner[start]!) : turn(inner[(start + j) % S]!);
  let i = 0, j = 0;
  while (i < M || j < S) {
    const L = outer[i % M]!, L1 = outer[(i + 1) % M]!, R = inner[(start + j) % S]!, R1 = inner[(start + j + 1) % S]!;
    const advanceOuter = j >= S || (i < M && outerAt(i + 1) <= innerAt(j + 1));
    if (advanceOuter) { faces.push(L, L1, R); i++; }
    else { faces.push(L, R1, R); j++; }
  }
}

export function insetDecal(mesh: ReducedMesh, field: SculptField, decal: SculptDecal, cell: number): ReducedMesh {
  const P = mesh.positions.slice(), F = mesh.faces;
  const outer = decal.rings[0]!;
  const removed = new Uint8Array(F.length / 3);
  const keep: number[] = [];
  for (let f = 0; f < F.length / 3; f++) {
    let x = 0, y = 0, z = 0;
    for (let e = 0; e < 3; e++) { const v = F[f * 3 + e]!; x += P[v * 3]!; y += P[v * 3 + 1]!; z += P[v * 3 + 2]!; }
    if (outer.shape.distance(x / 3, y / 3, z / 3) < 0) removed[f] = 1;
    else keep.push(F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!);
  }
  const directed = new Map<number, number>();
  const n = P.length / 3;
  for (let f = 0; f < F.length / 3; f++) if (removed[f]) for (let e = 0; e < 3; e++) directed.set(F[f * 3 + e]! * n + F[f * 3 + (e + 1) % 3]!, 1);
  const next = new Map<number, number>();
  for (const code of directed.keys()) {
    const u = Math.floor(code / n), v = code % n;
    if (directed.has(v * n + u)) continue;
    if (next.has(u)) throw new Error('Sculpt decal ' + decal.label + ' covers a region with a pinched outline; enlarge or move it');
    next.set(u, v);
  }
  if (next.size < 3) throw new Error('Sculpt decal ' + decal.label + ' does not cover any surface; move it onto the body');
  const loop: number[] = [next.keys().next().value!];
  while (loop.length <= next.size) {
    const step = next.get(loop[loop.length - 1]!)!;
    if (step === loop[0]) break;
    loop.push(step);
  }
  if (loop.length !== next.size) throw new Error('Sculpt decal ' + decal.label + ' covers a region with holes or several pieces; enlarge or move it');
  const offset = new Vector3();
  const angle = (v: number) => {
    offset.set(P[v * 3]! - decal.center.x, P[v * 3 + 1]! - decal.center.y, P[v * 3 + 2]! - decal.center.z);
    return Math.atan2(offset.dot(decal.up), offset.dot(decal.right) / decal.stretch);
  };
  let winding = 0;
  for (let i = 0; i < loop.length; i++) {
    let delta = angle(loop[(i + 1) % loop.length]!) - angle(loop[i]!);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    winding += delta;
  }
  const sign = winding >= 0 ? 1 : -1;
  const signed = (v: number) => sign * angle(v);
  const point = new Vector3();
  const place = (radius: number, theta: number) => {
    point.copy(decal.center).addScaledVector(decal.right, Math.cos(theta) * radius * decal.stretch).addScaledVector(decal.up, Math.sin(theta) * radius);
    field.project(point, cell * 0.25, radius + cell);
    P.push(point.x, point.y, point.z);
    return P.length / 3 - 1;
  };
  const faces = keep;
  let previous = loop;
  for (const ring of decal.rings.slice(1)) {
    const current = Array.from({ length: decal.segments }, (_, j) => place(ring.radius, sign * (j / decal.segments) * Math.PI * 2));
    zipper(faces, previous, current, signed);
    previous = current;
  }
  const center = place(0, 0);
  for (let j = 0; j < previous.length; j++) faces.push(previous[j]!, previous[(j + 1) % previous.length]!, center);
  return { positions: P, faces };
}

