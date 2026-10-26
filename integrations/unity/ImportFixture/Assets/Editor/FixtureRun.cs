using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace LanternFixture
{
    [Serializable]
    public sealed class FixtureReport
    {
        public string editor = "";
        public string graphics = "";
        public string pipeline = "";
        public int processId;
        public string project = "";
        public string status = "running";
        public string error = "";
        public bool scenesSaved;
        public ImportResult[] imports = Array.Empty<ImportResult>();
        public CaptureResult[] captures = Array.Empty<CaptureResult>();
    }

    [Serializable]
    public sealed class CaptureResult
    {
        public string path = "";
        public int foregroundPixels;
        public int magentaPixels;
        public int width;
        public int height;
        public int renderSubmissions;
        public string imageSha256 = "";
        public int[] changedPixels = Array.Empty<int>();
    }

    public static class FixtureRun
    {
        private static readonly string RepositoryRoot = Path.GetFullPath(Environment.GetEnvironmentVariable("POLYSPOON_ROOT") ?? Path.Combine(Application.dataPath, "../../../.."));
        private static readonly string FixtureProjectRoot = Path.GetFullPath(Path.Combine(RepositoryRoot, "integrations/unity/ImportFixture"));
        private static string Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/unity"));
        private static string InputDirectory = "Assets/Inputs";
        private static string OutputDirectory = "Assets/Verified";
        private static readonly string[] Names = { "field", "harbor", "trail", "w0.44-h0.18-c0.075" };
        private static readonly List<ImportResult> Results = new List<ImportResult>();
        private static readonly List<CaptureResult> Captures = new List<CaptureResult>();

        public static void RunKit()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/unity-kit"));
            InputDirectory = "Assets/KitInputs";
            OutputDirectory = "Assets/VerifiedKit";
            Run();
        }

        public static void RunPolish()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/polish/unity"));
            InputDirectory = "Assets/PolishInputs";
            OutputDirectory = "Assets/VerifiedPolish";
            Run();
        }

        public static void RunRevision5()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/revision5/unity"));
            InputDirectory = "Assets/Revision5Inputs";
            OutputDirectory = "Assets/VerifiedRevision5";
            Run();
        }

        public static void RunRevision4()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/revision4/unity"));
            InputDirectory = "Assets/Revision4Inputs";
            OutputDirectory = "Assets/VerifiedRevision4";
            Run();
        }

        public static void RunRevision3()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/revision3/unity"));
            InputDirectory = "Assets/Revision3Inputs";
            OutputDirectory = "Assets/VerifiedRevision3";
            Run();
        }

        public static void RunRevision2()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/revision2/unity"));
            InputDirectory = "Assets/Revision2Inputs";
            OutputDirectory = "Assets/VerifiedRevision2";
            Run();
        }

        public static void RunRevision2CaptureReview()
        {
            Evidence = Path.GetFullPath(Path.Combine(RepositoryRoot, "evidence/revision2/unity/capture-review"));
            InputDirectory = "Assets/Revision2Inputs";
            OutputDirectory = "Assets/VerifiedRevision2CaptureReview";
            Run();
        }

        public static void Run()
        {
            Directory.CreateDirectory(Evidence);
            Results.Clear();
            Captures.Clear();
            var report = new FixtureReport
            {
                editor = Application.unityVersion,
                graphics = SystemInfo.graphicsDeviceName + " / " + SystemInfo.graphicsDeviceType,
                processId = System.Diagnostics.Process.GetCurrentProcess().Id,
                project = Path.GetDirectoryName(Application.dataPath)
            };
            try
            {
                FixtureChecks.Require(report.project == FixtureProjectRoot, "Unexpected project path");
                FixtureChecks.Require(Application.unityVersion == "6000.5.5f1", "Unexpected Editor version");
                FixtureChecks.Require(SystemInfo.graphicsDeviceType != GraphicsDeviceType.Null, "No render-capable graphics device");
                File.AppendAllText(Path.Combine(Evidence, "editor-events.log"), "FIXTURE_IDENTITY " + JsonUtility.ToJson(report) + Environment.NewLine);
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
                FixtureChecks.VerifyGeometryRegression();
                Directory.CreateDirectory(OutputDirectory);
                ConfigurePipeline();
                report.pipeline = GraphicsSettings.defaultRenderPipeline.name;
                var names = InputDirectory == "Assets/Inputs" ? Names : Directory.GetFiles(InputDirectory, "*.expected.json")
                    .Select(path => Path.GetFileName(path).Replace(".expected.json", "")).OrderBy(value => value).ToArray();
                FixtureChecks.Require(names.Length > 0, "No kit inputs supplied");
                foreach (var name in names) VerifyAsset(name);
                AssetDatabase.SaveAssets();
                Unity.CodeEditor.CodeEditor.CurrentEditor.SyncAll();
                report.scenesSaved = !EditorSceneManager.GetActiveScene().isDirty;
                FixtureChecks.Require(report.scenesSaved, "Unsaved scene remains");
                report.status = "passed";
                File.AppendAllText(Path.Combine(Evidence, "editor-events.log"), "FIXTURE_PASS imported=" + Results.Count + " captures=" + Captures.Count + Environment.NewLine);
            }
            catch (Exception exception)
            {
                report.status = "failed";
                report.error = exception.ToString();
                Debug.LogException(exception);
            }
            report.imports = Results.ToArray();
            report.captures = Captures.ToArray();
            File.WriteAllText(Path.Combine(Evidence, "results.json"), JsonUtility.ToJson(report, true));
            EditorApplication.Exit(report.status == "passed" ? 0 : 1);
        }

        private static void ConfigurePipeline()
        {
            var rendererPath = OutputDirectory + "/NeutralRenderer.asset";
            var pipelinePath = OutputDirectory + "/NeutralPipeline.asset";
            var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
            if (renderer == null)
            {
                renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, rendererPath);
            }
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if (pipeline == null)
            {
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(pipeline, pipelinePath);
            }
            pipeline.name = "NeutralPipeline";
            pipeline.supportsHDR = false;
            pipeline.msaaSampleCount = 1;
            pipeline.renderScale = 1;
            pipeline.supportsCameraDepthTexture = false;
            pipeline.supportsCameraOpaqueTexture = false;
            GraphicsSettings.defaultRenderPipeline = pipeline;
            QualitySettings.renderPipeline = pipeline;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            EditorUtility.SetDirty(pipeline);
            AssetDatabase.SaveAssets();
        }

        private static void VerifyAsset(string name)
        {
            var expected = JsonUtility.FromJson<ExpectedAsset>(File.ReadAllText(InputDirectory + "/" + name + ".expected.json"));
            FixtureChecks.Require(expected.name == name, "Input name differs from expectation");
            if (InputDirectory == "Assets/Inputs")
            {
                expected.sourceRoot = "work-lantern";
                expected.coordinateSpace = "unity";
                expected.lanternChecks = true;
                expected.up = Vector3.up;
                expected.front = Vector3.forward;
            }
            var path = InputDirectory + "/" + name + ".glb";
            using (var sha = SHA256.Create())
            {
                var hash = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-", "").ToLowerInvariant();
                FixtureChecks.Require(hash == expected.sha256, "Export SHA-256 mismatch: " + name);
            }
            var importer = AssetImporter.GetAtPath(path);
            FixtureChecks.Require(importer != null, "Missing glTFast importer");
            var settings = new SerializedObject(importer);
            var creation = settings.FindProperty("instantiationSettings.sceneObjectCreation");
            FixtureChecks.Require(creation != null, "Missing scene creation setting");
            var original = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            File.AppendAllText(Path.Combine(Evidence, "editor-events.log"), "FIXTURE_HIERARCHY_BEFORE " + name + " " + string.Join("/", original.GetComponentsInChildren<Transform>().Select(value => value.name)) + Environment.NewLine);
            creation.intValue = (int)GLTFast.SceneObjectCreation.Always;
            settings.ApplyModifiedPropertiesWithoutUndo();
            importer.SaveAndReimport();
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            FixtureChecks.Require(asset != null, "glTFast did not produce prefab: " + path);
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(asset);
            var result = FixtureChecks.Inspect(instance, expected);
            Results.Add(result);
            PrefabUtility.SaveAsPrefabAsset(instance, OutputDirectory + "/" + name + ".prefab", out var saved);
            FixtureChecks.Require(saved, "Prefab save failed");
            var savedPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(OutputDirectory + "/" + name + ".prefab");
            var prefabReload = (GameObject)PrefabUtility.InstantiatePrefab(savedPrefab);
            UnityEngine.Object.DestroyImmediate(instance);
            FixtureChecks.Inspect(prefabReload, expected);
            instance = prefabReload;
            ConfigureLighting();
            var camera = new GameObject("NeutralCamera").AddComponent<Camera>();
            camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.72f, 0.74f, 0.77f);
            camera.aspect = 1;
            camera.allowHDR = false;
            camera.allowMSAA = false;
            var additional = camera.GetUniversalAdditionalCameraData();
            additional.renderPostProcessing = false;
            additional.antialiasing = AntialiasingMode.None;
            var bounds = FixtureChecks.Measure(instance);
            var directions = new[] { Vector3.forward, new Vector3(2.7f, 1.85f, 3.5f).normalized };
            var views = new[] { "front", "oblique" };
            for (var index = 0; index < views.Length; index++)
            {
                FitCamera(camera, bounds, directions[index]);
                var capture = Capture(camera, name + "-" + views[index] + ".png");
                Captures.Add(capture);
                if (expected.requireUnlit)
                {
                    VerifyUnlitLighting(camera, name + "-" + views[index], capture);
                    result.unlitLightingVerified = true;
                }
            }
            var scenePath = OutputDirectory + "/" + name + ".unity";
            FixtureChecks.Require(EditorSceneManager.SaveScene(scene, scenePath), "Scene save failed");
            AssetDatabase.SaveAssets();
            var loaded = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
            FixtureChecks.Require(!loaded.isDirty, "Reloaded scene is dirty");
            var importedRoot = loaded.GetRootGameObjects().Single(value => value.GetComponentsInChildren<MeshFilter>().Length > 0);
            FixtureChecks.Inspect(importedRoot, expected);
            FixtureChecks.Require(EditorSceneManager.SaveScene(loaded, scenePath), "Post-validation scene save failed");
            FixtureChecks.Require(!EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single).isDirty, "Final scene reload is dirty");
            File.AppendAllText(Path.Combine(Evidence, "editor-events.log"), "FIXTURE_ASSET " + JsonUtility.ToJson(result) + Environment.NewLine);
        }

        private static void FitCamera(Camera camera, Bounds bounds, Vector3 direction)
        {
            var radius = bounds.extents.magnitude;
            FixtureChecks.Require(radius > 0, "Empty capture bounds");
            var distance = radius * 3 + 1;
            camera.transform.position = bounds.center + direction.normalized * distance;
            camera.transform.LookAt(bounds.center, Vector3.up);
            var halfHeight = 0f;
            var corners = new List<Vector3>();
            foreach (var x in new[] { bounds.min.x, bounds.max.x })
                foreach (var y in new[] { bounds.min.y, bounds.max.y })
                    foreach (var z in new[] { bounds.min.z, bounds.max.z })
                    {
                        var corner = new Vector3(x, y, z);
                        corners.Add(corner);
                        var local = camera.transform.InverseTransformPoint(corner);
                        halfHeight = Mathf.Max(halfHeight, Mathf.Abs(local.y), Mathf.Abs(local.x) / camera.aspect);
                    }
            camera.orthographicSize = halfHeight * 1.15f;
            camera.nearClipPlane = Mathf.Max(0.001f, distance - radius * 1.2f);
            camera.farClipPlane = distance + radius * 1.2f;
            foreach (var corner in corners)
            {
                var projected = camera.WorldToViewportPoint(corner);
                FixtureChecks.Require(projected.x > 0 && projected.x < 1 && projected.y > 0 && projected.y < 1
                    && projected.z > camera.nearClipPlane && projected.z < camera.farClipPlane, "Capture bounds clipped");
            }
        }

        private static void ConfigureLighting()
        {
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.5f, 0.5f, 0.5f);
            RenderSettings.ambientIntensity = 1;
            RenderSettings.skybox = null;
            RenderSettings.fog = false;
            var key = new GameObject("NeutralKey").AddComponent<Light>();
            key.type = LightType.Directional;
            key.color = Color.white;
            key.intensity = 1.1f;
            key.shadows = LightShadows.None;
            key.transform.rotation = Quaternion.Euler(42, -32, 0);
            var fill = new GameObject("NeutralFill").AddComponent<Light>();
            fill.type = LightType.Directional;
            fill.color = Color.white;
            fill.intensity = 0.45f;
            fill.shadows = LightShadows.None;
            fill.transform.rotation = Quaternion.Euler(15, 145, 0);
        }

        private static void VerifyUnlitLighting(Camera camera, string name, CaptureResult reference)
        {
            var lights = EditorSceneManager.GetActiveScene().GetRootGameObjects()
                .SelectMany(root => root.GetComponentsInChildren<Light>()).ToArray();
            var enabled = lights.Select(light => light.enabled).ToArray();
            var ambient = RenderSettings.ambientLight;
            var intensity = RenderSettings.ambientIntensity;
            try
            {
                foreach (var light in lights) light.enabled = false;
                RenderSettings.ambientLight = Color.black;
                RenderSettings.ambientIntensity = 0;
                var dark = Capture(camera, name + "-unlit-dark.png");
                Captures.Add(dark);
                FixtureChecks.Require(reference.imageSha256 == dark.imageSha256, "Unlit output changed with scene lighting: " + name);
            }
            finally
            {
                for (var i = 0; i < lights.Length; i++) lights[i].enabled = enabled[i];
                RenderSettings.ambientLight = ambient;
                RenderSettings.ambientIntensity = intensity;
            }
        }

        private static CaptureResult Capture(Camera camera, string filename)
        {
            var target = new RenderTexture(768, 768, 24, RenderTextureFormat.ARGB32);
            var image = new Texture2D(768, 768, TextureFormat.RGB24, false);
            var previous = RenderTexture.active;
            try
            {
                target.Create();
                var request = new UniversalRenderPipeline.SingleCameraRequest { destination = target };
                Color32[] pixels = Array.Empty<Color32>();
                var changes = new List<int>();
                var stable = false;
                var submissions = 0;
                for (var attempt = 0; attempt < 4; attempt++)
                {
                    RenderPipeline.SubmitRenderRequest(camera, request);
                    RenderTexture.active = target;
                    image.ReadPixels(new Rect(0, 0, 768, 768), 0, 0);
                    image.Apply();
                    var current = image.GetPixels32();
                    submissions++;
                    if (attempt == 0)
                        File.WriteAllBytes(Path.Combine(Evidence, "initial-" + filename), image.EncodeToPNG());
                    else
                    {
                        var changed = 0;
                        for (var index = 0; index < current.Length; index++)
                            if (!current[index].Equals(pixels[index])) changed++;
                        changes.Add(changed);
                        stable = changed == 0;
                    }
                    pixels = current;
                    if (stable) break;
                }
                File.AppendAllText(Path.Combine(Evidence, "editor-events.log"), "CAPTURE_STABILITY " + filename + " " + string.Join(",", changes) + Environment.NewLine);
                File.WriteAllBytes(Path.Combine(Evidence, filename), image.EncodeToPNG());
                FixtureChecks.Require(stable, "Render did not stabilize: " + filename);
                var background = pixels[0];
                var result = new CaptureResult { path = filename, width = 768, height = 768, renderSubmissions = submissions, changedPixels = changes.ToArray() };
                foreach (var pixel in pixels)
                {
                    if (Math.Abs(pixel.r - background.r) + Math.Abs(pixel.g - background.g) + Math.Abs(pixel.b - background.b) > 25)
                        result.foregroundPixels++;
                    if (pixel.r > 220 && pixel.b > 220 && pixel.g < 40)
                        result.magentaPixels++;
                }
                File.WriteAllBytes(Path.Combine(Evidence, filename), image.EncodeToPNG());
                FixtureChecks.Require(result.foregroundPixels > 5000, "Empty or unreadable render: " + filename);
                FixtureChecks.Require(result.magentaPixels == 0, "Shader error pixels: " + filename);
                using (var sha = SHA256.Create())
                    result.imageSha256 = BitConverter.ToString(sha.ComputeHash(image.EncodeToPNG())).Replace("-", "").ToLowerInvariant();
                return result;
            }
            finally
            {
                RenderTexture.active = previous;
                target.Release();
                UnityEngine.Object.DestroyImmediate(target);
                UnityEngine.Object.DestroyImmediate(image);
            }
        }
    }
}
