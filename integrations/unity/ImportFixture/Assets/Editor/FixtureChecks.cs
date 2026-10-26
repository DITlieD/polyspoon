using System;
using System.Linq;
using UnityEngine;

namespace LanternFixture
{
    [Serializable]
    public sealed class ExpectedAsset
    {
        public string name = "";
        public string sha256 = "";
        public string sourceRoot = "work-lantern";
        public string coordinateSpace = "unity";
        public bool lanternChecks = true;
        public bool verifyAppearance;
        public bool requireUnlit;
        public Vector3 groundAnchor;
        public Vector3 up = Vector3.up;
        public Vector3 front = Vector3.forward;
        public Vector3 minimum;
        public Vector3 maximum;
        public int triangles;
        public float gapWidth;
        public float gapBottom;
        public float gapHeight;
        public ExpectedPart[] parts = Array.Empty<ExpectedPart>();
        public ExpectedMaterial[] materials = Array.Empty<ExpectedMaterial>();
    }

    [Serializable]
    public sealed class ExpectedPart
    {
        public string name = "";
        public string material = "";
        public bool verifyBounds;
        public bool verifyVertexColors;
        public Color[] vertexColors = Array.Empty<Color>();
        public Vector3 minimum;
        public Vector3 maximum;
    }

    [Serializable]
    public sealed class ExpectedMaterial
    {
        public string name = "";
        public Color linearColor;
        public bool verifyShader;
        public bool unlit;
    }

    [Serializable]
    public sealed class ImportResult
    {
        public string name = "";
        public Vector3 minimum;
        public Vector3 maximum;
        public int triangles;
        public int vertices;
        public int verifiedColorVertices;
        public bool unlitLightingVerified;
        public int frontGapSamples;
        public int obliqueGapSamples;
        public string[] hierarchy = Array.Empty<string>();
        public string[] shaders = Array.Empty<string>();
        public bool negativeScaleRejected;
    }

    public static class FixtureChecks
    {
        public static void VerifyGeometryRegression()
        {
            var root = new GameObject("bounds-regression");
            var mesh = new Mesh();
            try
            {
                mesh.vertices = new[] { Vector3.zero, new Vector3(2, 0, 0), new Vector3(0, 1, 0) };
                mesh.triangles = new[] { 0, 1, 2 };
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();
                root.AddComponent<MeshFilter>().sharedMesh = mesh;
                root.AddComponent<MeshRenderer>();
                root.transform.rotation = Quaternion.Euler(0, 0, 45);
                var bounds = Measure(root);
                Require(Mathf.Abs(bounds.max.y - Mathf.Sqrt(2)) < 0.00002f, "Rotated local AABB inflated exact vertex bounds");
                Require(Mathf.Abs(bounds.min.x + Mathf.Sqrt(0.5f)) < 0.00002f, "Asymmetric vertex minimum changed");
                mesh.vertices = new[] { Vector3.zero, new Vector3(0.002f, 0, 0), new Vector3(0, 0.003f, 0) };
                mesh.normals = new[] { Vector3.forward, Vector3.forward, Vector3.forward };
                CheckNormals(mesh);
                mesh.normals = new[] { Vector3.back, Vector3.back, Vector3.back };
                var reversedRejected = false;
                try { CheckNormals(mesh); }
                catch (InvalidOperationException) { reversedRejected = true; }
                Require(reversedRejected, "Reversed small-face normals were accepted");
                mesh.vertices = new[] { Vector3.zero, new Vector3(0.002f, 0, 0), new Vector3(0.003f, 0, 0) };
                var degenerateRejected = false;
                try { CheckNormals(mesh); }
                catch (InvalidOperationException) { degenerateRejected = true; }
                Require(degenerateRejected, "Degenerate small face was accepted");
                mesh.colors = new[] { Color.red, Color.green, Color.blue };
                var expectedColors = new ExpectedPart { name = "color-regression", vertexColors = new[] { Color.red, Color.green, Color.blue } };
                CheckVertexColors(mesh, expectedColors);
                expectedColors.vertexColors[1] = Color.white;
                var colorRejected = false;
                try { CheckVertexColors(mesh, expectedColors); }
                catch (InvalidOperationException) { colorRejected = true; }
                Require(colorRejected, "Changed vertex color was accepted");
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(root);
                UnityEngine.Object.DestroyImmediate(mesh);
            }
        }

        public static void Require(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }

        public static Bounds Measure(GameObject root)
        {
            var points = root.GetComponentsInChildren<MeshFilter>()
                .SelectMany(filter => filter.sharedMesh.vertices.Select(vertex => filter.transform.TransformPoint(vertex))).ToArray();
            Require(points.Length > 0, "No imported mesh vertices");
            Require(points.All(point => float.IsFinite(point.x) && float.IsFinite(point.y) && float.IsFinite(point.z)), "Non-finite imported vertex");
            var bounds = new Bounds(points[0], Vector3.zero);
            foreach (var point in points.Skip(1)) bounds.Encapsulate(point);
            return bounds;
        }

        public static Vector3 SourcePoint(Vector3 point, string coordinateSpace)
        {
            Require(coordinateSpace == "unity" || coordinateSpace == "gltf", "Unknown coordinate space");
            return coordinateSpace == "gltf" ? new Vector3(-point.x, point.y, point.z) : point;
        }

        private static void CheckExtents(Bounds bounds, Vector3 minimum, Vector3 maximum, string coordinateSpace)
        {
            var a = SourcePoint(minimum, coordinateSpace);
            var b = SourcePoint(maximum, coordinateSpace);
            Require(Vector3.Distance(bounds.min, Vector3.Min(a, b)) < 0.00002f, "Minimum bounds mismatch: " + bounds.min);
            Require(Vector3.Distance(bounds.max, Vector3.Max(a, b)) < 0.00002f, "Maximum bounds mismatch: " + bounds.max);
        }

        public static void CheckBounds(GameObject root, ExpectedAsset expected)
        {
            var bounds = Measure(root);
            CheckExtents(bounds, expected.minimum, expected.maximum, expected.coordinateSpace);
            Require(Vector3.Distance(SourcePoint(expected.groundAnchor, expected.coordinateSpace), Vector3.zero) < 0.00002f, "Ground anchor is not the origin");
            Require(Mathf.Abs(bounds.min.y) < 0.00002f, "Origin is not grounded");
            if (expected.lanternChecks) Require(Mathf.Abs(bounds.center.x) < 0.00002f, "Footprint is not X-centered");
            Require(root.transform.position == Vector3.zero && root.transform.localScale == Vector3.one && Quaternion.Angle(root.transform.rotation, Quaternion.identity) < 0.001f, "Root transform changes meter scale");
        }

        public static ImportResult Inspect(GameObject root, ExpectedAsset expected)
        {
            Require(root != null, "Missing imported object");
            CheckBounds(root, expected);
            var result = new ImportResult { name = expected.name };
            var filters = root.GetComponentsInChildren<MeshFilter>();
            Require(filters.Length == expected.parts.Length, "Named part count changed");
            result.hierarchy = root.GetComponentsInChildren<Transform>().Select(value => value.name).ToArray();
            Require(result.hierarchy.Contains(expected.sourceRoot), "Generator root name missing");
            var source = root.GetComponentsInChildren<Transform>().Single(value => value != root.transform && value.name == expected.sourceRoot);
            Require(Vector3.Distance(source.TransformPoint(SourcePoint(expected.groundAnchor, expected.coordinateSpace)), Vector3.zero) < 0.00002f, "Imported ground anchor moved");
            Require(Mathf.Abs(expected.up.magnitude - 1) < 0.00001f && Mathf.Abs(expected.front.magnitude - 1) < 0.00001f, "Invalid declared orientation");
            Require(Vector3.Angle(source.TransformDirection(SourcePoint(expected.up, expected.coordinateSpace)), Vector3.up) < 0.001f, "Source Y-up changed");
            Require(Vector3.Angle(source.TransformDirection(SourcePoint(expected.front, expected.coordinateSpace)), Vector3.forward) < 0.001f, "Source front changed");
            foreach (var part in expected.parts)
            {
                var filter = filters.Single(value => value.name == part.name);
                var renderer = filter.GetComponent<MeshRenderer>();
                Require(renderer.sharedMaterials.Length == 1 && renderer.sharedMaterial.name == part.material, "Material role mismatch: " + part.name);
                if (part.verifyBounds) CheckExtents(Measure(filter.gameObject), part.minimum, part.maximum, expected.coordinateSpace);
                CheckNormals(filter.sharedMesh);
                if (part.verifyVertexColors) result.verifiedColorVertices += CheckVertexColors(filter.sharedMesh, part);
                result.vertices += filter.sharedMesh.vertexCount;
                result.triangles += filter.sharedMesh.triangles.Length / 3;
            }
            Require(result.triangles == expected.triangles, "Triangle count changed");
            var materials = filters.Select(value => value.GetComponent<MeshRenderer>().sharedMaterial).Distinct().ToArray();
            Require(materials.Length == expected.materials.Length, "Material count changed");
            foreach (var expectedMaterial in expected.materials)
            {
                var material = materials.Single(value => value.name == expectedMaterial.name);
                if (expectedMaterial.verifyShader)
                    Require(material.shader.name.EndsWith("/glTF-unlit", StringComparison.Ordinal) == expectedMaterial.unlit, "Unlit shader selection changed: " + material.name);
                Require(material.shader.isSupported, "Unsupported shader: " + material.shader.name);
                Require(material.HasProperty("baseColorFactor"), "Missing glTF color property");
                var importedLinear = material.GetColor("baseColorFactor").linear;
                var wanted = expectedMaterial.linearColor;
                Require(Mathf.Abs(importedLinear.r - wanted.r) < 0.0001f
                    && Mathf.Abs(importedLinear.g - wanted.g) < 0.0001f
                    && Mathf.Abs(importedLinear.b - wanted.b) < 0.0001f, "Color changed: " + material.name);
                Require(Mathf.Abs(importedLinear.a - 1) < 0.0001f && material.renderQueue < 2500
                    && material.GetTag("RenderType", false) != "Transparent", "Material is not opaque");
            }
            result.shaders = materials.Select(value => value.shader.name).Distinct().ToArray();
            if (expected.lanternChecks)
            {
                var switchRenderer = filters.Single(value => value.name == "switch").GetComponent<MeshRenderer>();
                Require(switchRenderer.bounds.center.z > 0 && switchRenderer.bounds.max.z >= Measure(root).max.z - 0.00002f, "Switch must face +Z");
                var handle = filters.Single(value => value.name == "handle").GetComponent<MeshRenderer>();
                var foot = filters.Single(value => value.name == "foot").GetComponent<MeshRenderer>();
                Require(handle.bounds.center.y > foot.bounds.max.y, "Y-up orientation changed");
                CheckOpening(root, expected, result);
            }
            var bounds = Measure(root);
            result.minimum = bounds.min;
            result.maximum = bounds.max;
            root.transform.localScale = Vector3.one * 2;
            try
            {
                CheckBounds(root, expected);
            }
            catch (InvalidOperationException)
            {
                result.negativeScaleRejected = true;
            }
            finally
            {
                root.transform.localScale = Vector3.one;
            }
            Require(result.negativeScaleRejected, "Doubled scale negative control was not rejected");
            return result;
        }

        private static int CheckVertexColors(Mesh mesh, ExpectedPart part)
        {
            var actual = mesh.colors;
            Require(actual.Length == part.vertexColors.Length, "Vertex color count changed: " + part.name);
            for (var i = 0; i < actual.Length; i++)
            {
                var a = actual[i];
                var b = part.vertexColors[i];
                Require(float.IsFinite(a.r) && float.IsFinite(a.g) && float.IsFinite(a.b) && float.IsFinite(a.a)
                    && a.r >= 0 && a.r <= 1 && a.g >= 0 && a.g <= 1 && a.b >= 0 && a.b <= 1 && a.a >= 0 && a.a <= 1,
                    "Invalid imported vertex color: " + part.name);
                Require(Mathf.Abs(a.r - b.r) < 0.000001f && Mathf.Abs(a.g - b.g) < 0.000001f
                    && Mathf.Abs(a.b - b.b) < 0.000001f && Mathf.Abs(a.a - b.a) < 0.000001f,
                    "Vertex color changed: " + part.name + " vertex " + i);
            }
            return actual.Length;
        }

        private static void CheckNormals(Mesh mesh)
        {
            var normals = mesh.normals;
            var vertices = mesh.vertices;
            var indices = mesh.triangles;
            Require(normals.Length == vertices.Length, "Normal count mismatch");
            foreach (var normal in normals)
                Require(float.IsFinite(normal.x) && float.IsFinite(normal.y) && float.IsFinite(normal.z)
                    && Mathf.Abs(normal.magnitude - 1) < 0.001f, "Invalid unit normal");
            for (var index = 0; index < indices.Length; index += 3)
            {
                var a = indices[index];
                var b = indices[index + 1];
                var c = indices[index + 2];
                var face = Vector3.Cross(vertices[b] - vertices[a], vertices[c] - vertices[a]);
                Require(face.sqrMagnitude > 0.000000000001f, "Degenerate triangle");
                var average = normals[a] + normals[b] + normals[c];
                var averageLength = average.magnitude;
                Require(float.IsFinite(face.sqrMagnitude) && float.IsFinite(averageLength) && averageLength > 0, "Invalid face normal magnitude");
                Require(Vector3.Dot(face / face.magnitude, average / averageLength) > 0.1f, "Normal opposes winding");
            }
        }

        private static void CheckOpening(GameObject root, ExpectedAsset expected, ImportResult result)
        {
            var colliders = root.GetComponentsInChildren<MeshFilter>()
                .Select(value =>
                {
                    var collider = value.gameObject.AddComponent<MeshCollider>();
                    collider.sharedMesh = value.sharedMesh;
                    return collider;
                }).ToArray();
            var previousBackfaces = Physics.queriesHitBackfaces;
            Physics.queriesHitBackfaces = true;
            Physics.SyncTransforms();
            try
            {
                foreach (var x in new[] { -0.25f, 0f, 0.25f })
                    foreach (var fraction in new[] { 0.15f, 0.5f, 0.85f })
                    {
                        var origin = new Vector3(x * expected.gapWidth, expected.gapBottom + fraction * expected.gapHeight, 2);
                        if (!Physics.Raycast(origin, Vector3.back, 4)) result.frontGapSamples++;
                    }
                var direction = new Vector3(2.7f, 1.85f, 3.5f).normalized;
                foreach (var x in new[] { -0.18f, 0f, 0.18f })
                    foreach (var fraction in new[] { 0.2f, 0.35f, 0.5f, 0.65f, 0.8f })
                    {
                        var point = new Vector3(x * expected.gapWidth, expected.gapBottom + fraction * expected.gapHeight, 0);
                        if (!Physics.Raycast(point + direction * 2, -direction, 4)) result.obliqueGapSamples++;
                    }
                Require(result.frontGapSamples == 9, "Front carry gap is obstructed");
                Require(result.obliqueGapSamples >= 9, "Oblique carry gap is obstructed");
                Require(Physics.Raycast(new Vector3(0, 0.01f, 2), Vector3.back, 4), "Collider ray positive control missed the foot");
            }
            finally
            {
                Physics.queriesHitBackfaces = previousBackfaces;
                foreach (var collider in colliders) UnityEngine.Object.DestroyImmediate(collider);
            }
        }
    }
}
