export interface TopologyReport {
  shells: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  windingErrors: number;
  pinchedVertices: number;
  problems: number[];
}

export function faceShells(faces: ArrayLike<number>, vertexCount: number): Int32Array {
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (v: number): number => {
    while (parent[v] !== v) { parent[v] = parent[parent[v]!]!; v = parent[v]!; }
    return v;
  };
  for (let f = 0; f < faces.length; f += 3) {
    const a = find(faces[f]!), b = find(faces[f + 1]!);
    parent[b] = a;
    parent[find(faces[f + 2]!)] = a;
  }
  const label = new Map<number, number>();
  const shell = new Int32Array(faces.length / 3);
  for (let f = 0; f < faces.length; f += 3) {
    const root = find(faces[f]!);
    if (!label.has(root)) label.set(root, label.size);
    shell[f / 3] = label.get(root)!;
  }
  return shell;
}

export function inspectTopology(faces: ArrayLike<number>, vertexCount: number): TopologyReport {
  const count = faces.length;
  const directed = new Float64Array(count), plain = new Float64Array(count);
  for (let f = 0; f < count; f += 3) for (let e = 0; e < 3; e++) {
    const u = faces[f + e]!, v = faces[f + (e + 1) % 3]!;
    directed[f + e] = u * vertexCount + v;
    plain[f + e] = Math.min(u, v) * vertexCount + Math.max(u, v);
  }
  directed.sort();
  plain.sort();
  let boundaryEdges = 0, nonManifoldEdges = 0, windingErrors = 0;
  const problems: number[] = [];
  for (let i = 0; i < count;) {
    let j = i + 1;
    while (j < count && directed[j] === directed[i]) j++;
    if (j - i > 1) windingErrors++;
    i = j;
  }
  for (let i = 0; i < count;) {
    let j = i + 1;
    while (j < count && plain[j] === plain[i]) j++;
    if (j - i !== 2) {
      if (j - i === 1) boundaryEdges++; else nonManifoldEdges++;
      if (problems.length < 64) problems.push(Math.floor(plain[i]! / vertexCount));
    }
    i = j;
  }
  const start = new Int32Array(vertexCount + 1);
  for (let k = 0; k < count; k++) start[faces[k]! + 1] = start[faces[k]! + 1]! + 1;
  for (let v = 0; v < vertexCount; v++) start[v + 1] = start[v + 1]! + start[v]!;
  const fill = start.slice(0, vertexCount);
  const nextOf = new Int32Array(count), prevOf = new Int32Array(count);
  for (let f = 0; f < count; f += 3) for (let e = 0; e < 3; e++) {
    const v = faces[f + e]!, slot = fill[v]!++;
    nextOf[slot] = faces[f + (e + 1) % 3]!;
    prevOf[slot] = faces[f + (e + 2) % 3]!;
  }
  let pinchedVertices = 0;
  for (let v = 0; v < vertexCount; v++) {
    const from = start[v]!, to = start[v + 1]!, size = to - from;
    if (!size) continue;
    let walk = nextOf[from]!, steps = 0;
    const first = walk;
    do {
      let found = -1;
      for (let s = from; s < to; s++) if (nextOf[s] === walk) { found = s; break; }
      if (found < 0) break;
      walk = prevOf[found]!;
      steps++;
    } while (walk !== first && steps <= size);
    if (steps !== size || walk !== first) { pinchedVertices++; if (problems.length < 64) problems.push(v); }
  }
  let shells = 0;
  for (const id of faceShells(faces, vertexCount)) shells = Math.max(shells, id + 1);
  return { shells, boundaryEdges, nonManifoldEdges, windingErrors, pinchedVertices, problems };
}

