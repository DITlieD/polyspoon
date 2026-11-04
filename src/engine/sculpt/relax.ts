import { Vector3 } from 'three';
import type { SculptField, SculptShape } from './field.ts';

function faceNormal(P: ArrayLike<number>, a: number, b: number, c: number, out: Vector3): Vector3 {
  const ux = P[b * 3]! - P[a * 3]!, uy = P[b * 3 + 1]! - P[a * 3 + 1]!, uz = P[b * 3 + 2]! - P[a * 3 + 2]!;
  const vx = P[c * 3]! - P[a * 3]!, vy = P[c * 3 + 1]! - P[a * 3 + 1]!, vz = P[c * 3 + 2]! - P[a * 3 + 2]!;
  return out.set(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

function shapeGradient(shape: SculptShape, p: Vector3, step: number, out: Vector3): Vector3 {
  return out.set(
    shape.distance(p.x + step, p.y, p.z) - shape.distance(p.x - step, p.y, p.z),
    shape.distance(p.x, p.y + step, p.z) - shape.distance(p.x, p.y - step, p.z),
    shape.distance(p.x, p.y, p.z + step) - shape.distance(p.x, p.y, p.z - step),
  ).multiplyScalar(1 / (2 * step));
}

export function settleRound(P: number[], F: number[], field: SculptField, cell: number, pin?: Uint8Array): number[] {
  const n = P.length / 3;
  const overlayRank = new Map(field.overlays.map((shape, index) => [shape, index]));
  const scratch = new Vector3(), gradient = new Vector3();
  {
    const faceCount = F.length / 3;
    const before = Array.from({ length: faceCount }, (_, f) => faceNormal(P, F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!, new Vector3()).normalize());
    const sum = new Float64Array(n * 3), count = new Float64Array(n), normals = new Float64Array(n * 3);
    for (let f = 0; f < faceCount; f++) {
      const area = faceNormal(P, F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!, scratch);
      for (let e = 0; e < 3; e++) {
        const v = F[f * 3 + e]!, w = F[f * 3 + (e + 1) % 3]!;
        for (let k = 0; k < 3; k++) { sum[v * 3 + k] = sum[v * 3 + k]! + (P[w * 3 + k]!); sum[w * 3 + k] = sum[w * 3 + k]! + (P[v * 3 + k]!); }
        count[v] = count[v]! + 1; count[w] = count[w]! + 1;
        normals[v * 3] = normals[v * 3]! + area.x; normals[v * 3 + 1] = normals[v * 3 + 1]! + area.y; normals[v * 3 + 2] = normals[v * 3 + 2]! + area.z;
      }
    }
    const sharp = new Uint8Array(n);
    for (let f = 0; f < faceCount; f++) for (let e = 0; e < 3; e++) {
      const v = F[f * 3 + e]!;
      const length = Math.hypot(normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!) || 1;
      const face = before[f]!;
      if ((face.x * normals[v * 3]! + face.y * normals[v * 3 + 1]! + face.z * normals[v * 3 + 2]!) / length < 0.55) sharp[v] = 1;
    }
    const owners = Array.from({ length: faceCount }, (_, f) => {
      const a = F[f * 3]!, b = F[f * 3 + 1]!, c = F[f * 3 + 2]!;
      return field.ownerAt((P[a * 3]! + P[b * 3]! + P[c * 3]!) / 3, (P[a * 3 + 1]! + P[b * 3 + 1]! + P[c * 3 + 1]!) / 3, (P[a * 3 + 2]! + P[b * 3 + 2]! + P[c * 3 + 2]!) / 3);
    });
    const involved: Set<SculptShape>[] = Array.from({ length: n }, () => new Set()), mixed = new Uint8Array(n), firstOwner: (SculptShape | null)[] = new Array(n).fill(null);
    for (let f = 0; f < faceCount; f++) for (let e = 0; e < 3; e++) {
      const v = F[f * 3 + e]!, owner = owners[f]!;
      if (firstOwner[v] === null) firstOwner[v] = owner;
      else if (firstOwner[v] !== owner) mixed[v] = 1;
      if (overlayRank.has(owner)) involved[v]!.add(owner);
    }
    const next = P.slice();
    const point = new Vector3(), normal = new Vector3(), move = new Vector3();
    for (let v = 0; v < n; v++) {
      if (!count[v] || pin?.[v]) continue;
      point.set(P[v * 3]!, P[v * 3 + 1]!, P[v * 3 + 2]!);
      normal.set(normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!).normalize();
      move.set(sum[v * 3]! / count[v]! - point.x, sum[v * 3 + 1]! / count[v]! - point.y, sum[v * 3 + 2]! / count[v]! - point.z);
      move.addScaledVector(normal, -move.dot(normal));
      if (!sharp[v]) point.addScaledVector(move, 0.5);
      field.project(point, cell * 0.25, cell);
      let overlay: SculptShape | null = null;
      if (mixed[v]) {
        let nearest = Infinity;
        for (const shape of involved[v]!) {
          const d = Math.abs(shape.distance(point.x, point.y, point.z));
          if (d < nearest) { nearest = d; overlay = shape; }
        }
      }
      if (overlay) for (let i = 0; i < 4; i++) {
        const d = overlay.distance(point.x, point.y, point.z);
        shapeGradient(overlay, point, cell * 0.1, gradient);
        const g2 = gradient.lengthSq();
        if (g2 > 1e-12) point.addScaledVector(gradient, -d / g2);
        field.project(point, cell * 0.25, cell);
      }
      next[v * 3] = point.x; next[v * 3 + 1] = point.y; next[v * 3 + 2] = point.z;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      let reverted = 0;
      for (let f = 0; f < faceCount; f++) {
        const after = faceNormal(next, F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!, scratch);
        if (after.lengthSq() > 1e-20 && after.normalize().dot(before[f]!) > 0.3) continue;
        for (let e = 0; e < 3; e++) {
          const v = F[f * 3 + e]!;
          if (next[v * 3] === P[v * 3] && next[v * 3 + 1] === P[v * 3 + 1] && next[v * 3 + 2] === P[v * 3 + 2]) continue;
          for (let k = 0; k < 3; k++) next[v * 3 + k] = P[v * 3 + k]!;
          reverted++;
        }
      }
      if (!reverted) break;
    }
    return next;
  }
}


