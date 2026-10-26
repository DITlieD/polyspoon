using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;
using UnityEngine;

namespace LanternFixture
{
    public static class FixtureBootstrap
    {
        private static readonly string Project = Path.GetFullPath(Environment.GetEnvironmentVariable("POLYSPOON_ROOT") ?? Path.Combine(Application.dataPath, "../../../.."));
        private static AddAndRemoveRequest request;
        private static double deadline;

        public static void Install()
        {
            if (Path.GetFullPath(Application.dataPath) != Path.GetFullPath(Path.Combine(Project, "integrations/unity/ImportFixture/Assets")))
                throw new InvalidOperationException("Unexpected project");
            File.AppendAllText(Path.GetFullPath(Path.Combine(Project, "evidence/unity/editor-events.log")), "A2_IDENTITY project=" + Application.dataPath + " pid=" + System.Diagnostics.Process.GetCurrentProcess().Id + Environment.NewLine);
            if (AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Inputs/field.glb") != null)
                throw new InvalidOperationException("Expected initial absent-import test to fail");
            File.AppendAllText(Path.GetFullPath(Path.Combine(Project, "evidence/unity/editor-events.log")), "A2_RED missing imported field.glb detected before fixture implementation" + Environment.NewLine);
            request = Client.AddAndRemove(
                new[] { "com.unity.render-pipelines.universal@17.5.0", "com.unity.cloud.gltfast@6.20.0" },
                new[] { "com.unity.ai.navigation", "com.unity.collab-proxy", "com.unity.ide.rider", "com.unity.inputsystem", "com.unity.timeline", "com.unity.ugui", "com.unity.visualscripting" });
            deadline = EditorApplication.timeSinceStartup + 600;
            EditorApplication.update += Poll;
        }

        private static void Poll()
        {
            if (!request.IsCompleted && EditorApplication.timeSinceStartup < deadline) return;
            EditorApplication.update -= Poll;
            if (!request.IsCompleted || request.Status != StatusCode.Success)
            {
                Debug.LogError("A2_PACKAGE_FAILED " + request.Error?.message);
                EditorApplication.Exit(2);
                return;
            }
            File.AppendAllText(Path.GetFullPath(Path.Combine(Project, "evidence/unity/editor-events.log")), "A2_PACKAGES " + string.Join(", ", request.Result.Select(value => value.name + "@" + value.version)) + Environment.NewLine);
            AssetDatabase.SaveAssets();
            EditorApplication.Exit(0);
        }
    }
}
