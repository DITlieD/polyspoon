using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Object = UnityEngine.Object;

namespace OpenPoly.Workshop.Editor
{
    public static class WorkshopAssets
    {
        private const string OutputDirectory = "Assets/WorkshopGenerated";

        public static GeneratedAsset Apply(JObject response, GeneratedAsset target = null)
        {
            if ((int?)response["protocolVersion"] != 1) throw new InvalidDataException("Unsupported build response");
            var design = response["design"] as JObject ?? throw new InvalidDataException("Missing design");
            var family = (string)design["family"];
            var version = (string)design["familyVersion"];
            var source = (string)response["sourceHash"];
            if (string.IsNullOrWhiteSpace(family) || string.IsNullOrWhiteSpace(version) || source == null || source.Length != 64)
                throw new InvalidDataException("Missing build identity");
            var bytes = Convert.FromBase64String((string)response["glbBase64"] ?? "");
            if (bytes.Length < 12 || bytes.Length > 16 * 1024 * 1024 || BitConverter.ToUInt32(bytes, 0) != 0x46546c67)
                throw new InvalidDataException("Invalid GLB payload");
            using (var hash = SHA256.Create())
                if (BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant() != (string)response["glbSha256"])
                    throw new InvalidDataException("GLB hash mismatch");
            if (target != null && (!target.gameObject.scene.IsValid() || EditorUtility.IsPersistent(target)
                || (target.GeneratedChild != null && target.GeneratedChild.parent != target.transform)))
                throw new InvalidOperationException("Select a scene root with its generated child directly attached");
            Directory.CreateDirectory(OutputDirectory);
            var path = OutputDirectory + "/build-" + Guid.NewGuid().ToString("N") + ".glb";
            GameObject replacement = null;
            var committed = false;
            try
            {
                File.WriteAllBytes(path, bytes);
                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
                var importer = AssetImporter.GetAtPath(path);
                if (importer == null) throw new InvalidDataException("glTFast importer is unavailable");
                using (var settings = new SerializedObject(importer))
                {
                    var creation = settings.FindProperty("instantiationSettings.sceneObjectCreation");
                    if (creation == null) throw new InvalidDataException("glTFast scene settings unavailable");
                    creation.intValue = (int)GLTFast.SceneObjectCreation.Always;
                    settings.ApplyModifiedPropertiesWithoutUndo();
                }
                importer.SaveAndReimport();
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null || prefab.GetComponentsInChildren<MeshFilter>().Length == 0)
                    throw new InvalidDataException("GLB import produced no geometry");
                if (prefab.GetComponentsInChildren<MeshFilter>().Any(value => value.sharedMesh == null || !AssetDatabase.Contains(value.sharedMesh))
                    || prefab.GetComponentsInChildren<MeshRenderer>().Any(renderer => renderer.sharedMaterials.Any(material => material == null || !AssetDatabase.Contains(material))))
                    throw new InvalidDataException("GLB import produced incomplete subassets");
                replacement = Object.Instantiate(prefab);
                replacement.name = "Generated";
                Undo.IncrementCurrentGroup();
                var group = Undo.GetCurrentGroup();
                Undo.SetCurrentGroupName(target == null ? "Create Polyspoon asset" : "Rebuild Polyspoon asset");
                try
                {
                    if (target == null)
                    {
                        var root = new GameObject(family);
                        Undo.RegisterCreatedObjectUndo(root, "Create Polyspoon root");
                        target = Undo.AddComponent<GeneratedAsset>(root);
                    }
                    Undo.RegisterCreatedObjectUndo(replacement, "Create generated subtree");
                    Undo.SetTransformParent(replacement.transform, target.transform, "Attach generated subtree");
                    replacement.transform.localPosition = Vector3.zero;
                    replacement.transform.localRotation = Quaternion.identity;
                    replacement.transform.localScale = Vector3.one;
                    var previous = target.GeneratedChild;
                    Undo.RecordObject(target, "Update Polyspoon identity");
                    target.SetIdentity(family, version, design.ToString(Newtonsoft.Json.Formatting.None), source, path, replacement.transform);
                    if (previous != null) Undo.DestroyObjectImmediate(previous.gameObject);
                    Undo.FlushUndoRecordObjects();
                    Undo.CollapseUndoOperations(group);
                    EditorSceneManager.MarkSceneDirty(target.gameObject.scene);
                    AssetDatabase.SaveAssets();
                    committed = true;
                    Selection.activeGameObject = target.gameObject;
                    return target;
                }
                catch
                {
                    Undo.RevertAllDownToGroup(group);
                    throw;
                }
            }
            finally
            {
                if (!committed)
                {
                    if (replacement != null) Object.DestroyImmediate(replacement);
                    AssetDatabase.DeleteAsset(path);
                }
            }
        }
    }
}
