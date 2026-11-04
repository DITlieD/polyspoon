import { FAR, type SculptField } from './field.ts';

export interface NetMesh {
  positions: number[];
  faces: number[];
  owners: number[];
  cell: number;
}

const BLOCK = 6;
const KUHN: [number, number, number, number][] = [[0, 1, 3, 7], [0, 1, 5, 7], [0, 2, 3, 7], [0, 2, 6, 7], [0, 4, 5, 7], [0, 4, 6, 7]];

export function marchTetrahedra(field: SculptField, cell: number, reach: number): NetMesh {
  if (!(cell > 0)) throw new Error('Sculpt cell size must be positive');
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const shape of field.shapes) for (let axis = 0; axis < 3; axis++) {
    lo[axis] = Math.min(lo[axis]!, shape.min[axis]!);
    hi[axis] = Math.max(hi[axis]!, shape.max[axis]!);
  }
  if (!Number.isFinite(lo[0]!)) throw new Error('Sculpt body has no shapes');
  const pad = reach * 0.5 + cell * 3;
  const half = Math.max(Math.abs(lo[0]!), Math.abs(hi[0]!)) + pad;
  const hx = Math.ceil(half / cell);
  const nx = hx * 2 + 1;
  const y0 = field.floor === null ? lo[1]! - pad : Math.max(lo[1]! - pad, field.floor - cell * 2.5);
  const z0 = lo[2]! - pad;
  const ny = Math.ceil((hi[1]! + pad - y0) / cell) + 1;
  const nz = Math.ceil((hi[2]! + pad - z0) / cell) + 1;
  const total = nx * ny * nz;
  if (total > 24_000_000) throw new Error('Sculpt grid is too fine (' + nx + 'x' + ny + 'x' + nz + '); raise the cell size');
  const px = (i: number) => (i - hx) * cell, py = (j: number) => y0 + j * cell, pz = (k: number) => z0 + k * cell;
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const values = new Float32Array(total);
  const ownerOf = new Int32Array(total).fill(-1);
  const inflate = reach + cell * 2;
  const active = new Uint8Array(field.shapes.reduce((most, shape) => Math.max(most, shape.id + 1), 0));
  for (let bk = 0; bk < nz; bk += BLOCK) for (let bj = 0; bj < ny; bj += BLOCK) for (let bi = 0; bi < nx; bi += BLOCK) {
    const ei = Math.min(nx, bi + BLOCK), ej = Math.min(ny, bj + BLOCK), ek = Math.min(nz, bk + BLOCK);
    const minX = px(bi), minY = py(bj), minZ = pz(bk), maxX = px(ei - 1), maxY = py(ej - 1), maxZ = pz(ek - 1);
    let any = false;
    for (const shape of field.shapes) {
      const hit = shape.min[0] - inflate <= maxX && shape.max[0] + inflate >= minX && shape.min[1] - inflate <= maxY && shape.max[1] + inflate >= minY && shape.min[2] - inflate <= maxZ && shape.max[2] + inflate >= minZ;
      active[shape.id] = hit ? 1 : 0;
      if (hit) any = true;
    }
    let fill = NaN;
    if (!any) fill = FAR;
    else {
      field.restrict(active);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      const diagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
      const center = field.value(cx, cy, cz);
      if (Math.abs(center) > diagonal * 2 + cell) fill = center;
    }
    for (let k = bk; k < ek; k++) for (let j = bj; j < ej; j++) for (let i = bi; i < ei; i++) {
      const index = at(i, j, k);
      if (Number.isNaN(fill)) {
        values[index] = field.value(px(i), py(j), pz(k));
        ownerOf[index] = field.owner ? field.owner.id : -1;
      } else values[index] = fill;
    }
  }
  field.restrict(null);
  const positions: number[] = [];
  const owners: number[] = [];
  const faces: number[] = [];
  const crossings = new Map<number, number>();
  const offsets = [0, 1, nx, nx + 1, nx * ny, nx * ny + 1, nx * ny + nx, nx * ny + nx + 1];
  const coord = (index: number): [number, number, number] => {
    const i = index % nx, j = Math.floor(index / nx) % ny, k = Math.floor(index / (nx * ny));
    return [px(i), py(j), pz(k)];
  };
  const crossing = (a: number, b: number) => {
    const key = a < b ? a * total + b : b * total + a;
    const known = crossings.get(key);
    if (known !== undefined) return known;
    const va = values[a]!, vb = values[b]!;
    const t = Math.min(0.97, Math.max(0.03, va / (va - vb)));
    const pa = coord(a), pb = coord(b);
    const id = positions.length / 3;
    positions.push(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t);
    owners.push(ownerOf[va < 0 ? a : b]!);
    crossings.set(key, id);
    return id;
  };
  const emit = (a: number, b: number, c: number, from: number, to: number) => {
    const ax = positions[a * 3]!, ay = positions[a * 3 + 1]!, az = positions[a * 3 + 2]!;
    const ux = positions[b * 3]! - ax, uy = positions[b * 3 + 1]! - ay, uz = positions[b * 3 + 2]! - az;
    const vx = positions[c * 3]! - ax, vy = positions[c * 3 + 1]! - ay, vz = positions[c * 3 + 2]! - az;
    const nxv = uy * vz - uz * vy, nyv = uz * vx - ux * vz, nzv = ux * vy - uy * vx;
    const p = coord(from), q = coord(to);
    if (nxv * (q[0] - p[0]) + nyv * (q[1] - p[1]) + nzv * (q[2] - p[2]) >= 0) faces.push(a, b, c);
    else faces.push(a, c, b);
  };
  const tet = [0, 0, 0, 0];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const base = at(i, j, k);
    let inside = 0;
    for (let c = 0; c < 8; c++) if (values[base + offsets[c]!]! < 0) inside++;
    if (inside === 0 || inside === 8) continue;
    for (const pattern of KUHN) {
      let mask = 0;
      for (let c = 0; c < 4; c++) { tet[c] = base + offsets[pattern[c]!]!; if (values[tet[c]!]! < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 15) continue;
      const ins: number[] = [], outs: number[] = [];
      for (let c = 0; c < 4; c++) (mask & (1 << c) ? ins : outs).push(tet[c]!);
      if (ins.length === 1 || outs.length === 1) {
        const lone = ins.length === 1 ? ins[0]! : outs[0]!;
        const rest = ins.length === 1 ? outs : ins;
        const a = crossing(lone, rest[0]!), b = crossing(lone, rest[1]!), c = crossing(lone, rest[2]!);
        const from = ins.length === 1 ? lone : rest[0]!, to = ins.length === 1 ? rest[0]! : lone;
        emit(a, b, c, from, to);
      } else {
        const [i0, i1] = ins as [number, number], [o0, o1] = outs as [number, number];
        const a = crossing(i0, o0), b = crossing(i0, o1), c = crossing(i1, o1), d = crossing(i1, o0);
        emit(a, b, c, i0, o0);
        emit(a, c, d, i0, o0);
      }
    }
  }
  return { positions, faces, owners, cell };
}

