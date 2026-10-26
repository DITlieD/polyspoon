using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.UIElements;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace OpenPoly.Workshop.Editor
{
    public sealed class WorkshopWindow : EditorWindow
    {
        [SerializeField] private string repositoryPath = "";
        [SerializeField] private string nodeExecutable = "node";
        private JObject catalog;
        private JObject currentRecipe;
        private WorkshopEditState editing = new WorkshopEditState();
        private CancellationTokenSource operation;
        private string operationKind;
        private bool windowEnabled;
        private bool applyingBuild;
        private bool observedSelection;
        private int selectionRevision;
        private Scene observedScene;
        private GeneratedAsset observedTarget;
        private string observedDesign;
        private GeneratedAsset resolvedTarget;

        public string RepositoryPath { get => repositoryPath; set => repositoryPath = value; }
        public string NodeExecutable { get => nodeExecutable; set => nodeExecutable = value; }
        public JObject Catalog => catalog;
        public JObject Parameters => editing.Parameters;
        public JObject SelectedDesign => editing.Baseline == null ? null : (JObject)editing.Baseline.DeepClone();
        public JObject ExplicitEdits => editing.Edits(currentRecipe);
        public bool IsBusy => operation != null;
        public bool IsSelectionResolved => resolvedTarget != null && resolvedTarget == SelectedRoot()
            && editing.Baseline != null && observedDesign == resolvedTarget.DesignJson
            && observedScene == SceneManager.GetActiveScene();

        [MenuItem("Window/Polyspoon")]
        public static void Open()
        {
            var window = GetWindow<WorkshopWindow>();
            window.titleContent = new GUIContent("Polyspoon");
            window.minSize = new Vector2(380, 480);
            window.Show();
        }

        private void OnEnable()
        {
            windowEnabled = true;
            repositoryPath = EditorPrefs.GetString("OpenPoly.Workshop.Repository", repositoryPath);
            nodeExecutable = EditorPrefs.GetString("OpenPoly.Workshop.Node", nodeExecutable);
            Selection.selectionChanged += SelectionChanged;
            Undo.undoRedoPerformed += UndoRedoPerformed;
        }

        private void OnDisable()
        {
            windowEnabled = false;
            selectionRevision++;
            observedSelection = false;
            Selection.selectionChanged -= SelectionChanged;
            Undo.undoRedoPerformed -= UndoRedoPerformed;
            Cancel();
        }

        public void CreateGUI()
        {
            rootVisualElement.Clear();
            var template = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>("Packages/com.openpoly.workshop/Editor/WorkshopWindow.uxml");
            if (template == null) throw new InvalidOperationException("Polyspoon window template is missing");
            template.CloneTree(rootVisualElement);
            var repository = rootVisualElement.Q<TextField>("repository");
            repository.SetValueWithoutNotify(repositoryPath);
            repository.RegisterValueChangedCallback(evt => repositoryPath = evt.newValue);
            var node = rootVisualElement.Q<TextField>("node");
            node.SetValueWithoutNotify(nodeExecutable);
            node.RegisterValueChangedCallback(evt => nodeExecutable = evt.newValue);
            rootVisualElement.Q<Button>("connect").clicked += () => RunButton(false, true);
            rootVisualElement.Q<Button>("build").clicked += () => RunButton(false, false);
            rootVisualElement.Q<Button>("rebuild").clicked += () => RunButton(true, false);
            rootVisualElement.Q<Button>("cancel").clicked += Cancel;
            rootVisualElement.Q<DropdownField>("recipe").RegisterValueChangedCallback(evt =>
            {
                var recipe = ((JArray)catalog["recipes"]).Cast<JObject>().First(d => (string)d["title"] == evt.newValue);
                ChooseRecipe((string)recipe["id"]);
            });
            rootVisualElement.Q<DropdownField>("preset").RegisterValueChangedCallback(evt =>
            {
                if (evt.newValue == "Saved design")
                {
                    editing.Load(currentRecipe, editing.Baseline);
                    RenderControls();
                    Status("Saved design controls restored. Appearance and migration history are retained.");
                }
                else ChoosePreset(evt.newValue == "Defaults" ? null : (string)((JArray)currentRecipe["presets"])
                    .First(preset => (string)preset["name"] == evt.newValue)["id"]);
            });
            SetBusy(IsBusy);
            RefreshSelection(true);
        }

        private void Observe(Task pending, int revision)
        {
            WorkshopEditorCompletion.Observe(pending, exception =>
            {
                if (revision == selectionRevision && windowEnabled)
                    Status(exception is OperationCanceledException ? "Operation cancelled. Previous asset retained." : exception.Message);
            });
        }

        private void RunButton(bool rebuild, bool connect)
        {
            try { Observe(connect ? LoadCatalogAsync() : BuildAsync(rebuild), selectionRevision); }
            catch (Exception exception) { Status(exception.Message); }
        }

        public void Cancel()
        {
            operation?.Cancel();
        }

        public Task<JObject> LoadCatalogAsync()
        {
            return Request("catalog", new JObject { ["protocolVersion"] = 1, ["operation"] = "catalog" }, response =>
            {
                catalog = response;
                EditorPrefs.SetString("OpenPoly.Workshop.Repository", repositoryPath);
                EditorPrefs.SetString("OpenPoly.Workshop.Node", nodeExecutable);
                rootVisualElement.Q<DropdownField>("recipe").choices = ((JArray)catalog["recipes"]).Select(d => (string)d["title"]).ToList();
                SetRecipe((string)catalog["recipes"][0]["id"]);
                editing.Fresh(currentRecipe);
                RenderControls();
                Status("Loaded " + ((JArray)catalog["recipes"]).Count + " local recipes.");
                return response;
            }, false, () => RefreshSelection(true));
        }

        private void SetRecipe(string family)
        {
            currentRecipe = ((JArray)catalog["recipes"]).Cast<JObject>().First(d => (string)d["id"] == family);
            rootVisualElement.Q<DropdownField>("recipe").SetValueWithoutNotify((string)currentRecipe["title"]);
            var preset = rootVisualElement.Q<DropdownField>("preset");
            preset.choices = new[] { "Defaults" }.Concat(((JArray)currentRecipe["presets"]).Select(p => (string)p["name"])).ToList();
            preset.SetValueWithoutNotify("Defaults");
            rootVisualElement.Q<Label>("description").text = (string)currentRecipe["description"];
        }

        private void SetPresetLabel(string label)
        {
            var choices = editing.Baseline == null ? new[] { "Defaults" } : new[] { "Saved design", "Defaults" };
            var preset = rootVisualElement.Q<DropdownField>("preset");
            preset.choices = choices.Concat(((JArray)currentRecipe["presets"]).Select(value => (string)value["name"])).ToList();
            preset.SetValueWithoutNotify(label);
        }

        public void ChooseRecipe(string family)
        {
            if (IsBusy) throw new InvalidOperationException("Wait for the active operation or cancel it");
            var retain = IsSelectionResolved && (string)editing.Baseline["family"] == family;
            SetRecipe(family);
            if (!retain)
            {
                resolvedTarget = null;
                editing.Fresh(currentRecipe);
                Status("Fresh recipe selected. Build a new asset, or select a generated root to edit it.");
            }
            ChoosePreset(null);
        }

        public void ChoosePreset(string id)
        {
            if (IsBusy || !editing.IsReady) throw new InvalidOperationException("Resolve the selected design before choosing a preset");
            var preset = id == null ? null : ((JArray)currentRecipe["presets"]).Cast<JObject>().First(p => (string)p["id"] == id);
            editing.Preset(currentRecipe, preset);
            SetPresetLabel(preset == null ? "Defaults" : (string)preset["name"]);
            RenderControls();
            SetBusy(false);
            if (editing.Baseline != null) Status("Preset controls selected. Saved appearance and migration history are retained.");
        }

        private void RenderControls()
        {
            var container = rootVisualElement.Q<ScrollView>("controls");
            container.Clear();
            if (!editing.IsReady) return;
            string group = null;
            foreach (JObject control in (JArray)currentRecipe["controls"])
            {
                var nextGroup = (string)control["group"];
                if (group != nextGroup)
                {
                    var heading = new Label(nextGroup);
                    heading.AddToClassList("control-group");
                    container.Add(heading);
                    group = nextGroup;
                }
                var element = CreateControl(control);
                element.name = "parameter-" + (string)control["key"];
                element.tooltip = (string)control["hint"];
                container.Add(element);
            }
        }

        private VisualElement CreateControl(JObject control)
        {
            var key = (string)control["key"];
            var label = (string)control["label"];
            switch ((string)control["kind"])
            {
                case "range":
                    var factor = (string)control["unit"] == "cm" ? 100f : 1f;
                    var unit = (string)control["inputUnit"] == "degrees" ? "°" : (string)control["unit"];
                    var suffix = unit == "none" ? "" : " (" + unit + ")";
                    var number = new FloatField(label + suffix) { value = (float)Parameters[key] * factor };
                    number.RegisterValueChangedCallback(evt => Parameters[key] = evt.newValue / factor);
                    return number;
                case "integer":
                    var integer = new IntegerField(label) { value = (int)Parameters[key] };
                    integer.RegisterValueChangedCallback(evt => Parameters[key] = evt.newValue);
                    return integer;
                case "toggle":
                    var toggle = new Toggle(label) { value = (bool)Parameters[key] };
                    toggle.RegisterValueChangedCallback(evt => Parameters[key] = evt.newValue);
                    return toggle;
                case "color":
                    if (!ColorUtility.TryParseHtmlString((string)Parameters[key], out var initial)) throw new InvalidOperationException("Invalid catalog color");
                    var color = new ColorField(label) { value = initial, showAlpha = false, hdr = false };
                    color.RegisterValueChangedCallback(evt => Parameters[key] = "#" + ColorUtility.ToHtmlStringRGB(evt.newValue).ToLowerInvariant());
                    return color;
                case "choice":
                    var options = (JArray)control["options"];
                    var selected = options.First(o => (string)o["value"] == (string)Parameters[key]);
                    var choice = new DropdownField(label, options.Select(o => (string)o["label"]).ToList(), options.IndexOf(selected));
                    choice.RegisterValueChangedCallback(evt => Parameters[key] = (string)options[choice.index]["value"]);
                    return choice;
                default: throw new InvalidOperationException("Unsupported catalog control");
            }
        }

        private static GeneratedAsset SelectedRoot()
        {
            return Selection.activeGameObject == null ? null : Selection.activeGameObject.GetComponentInParent<GeneratedAsset>();
        }

        private void SelectionChanged()
        {
            if (!applyingBuild) RefreshSelection(false);
        }

        private void UndoRedoPerformed()
        {
            if (!applyingBuild) RefreshSelection(false);
        }

        private void RefreshSelection(bool force)
        {
            if (!windowEnabled || rootVisualElement.Q<Label>("selection") == null) return;
            var selected = SelectedRoot();
            var design = selected == null ? null : selected.DesignJson;
            var scene = SceneManager.GetActiveScene();
            if (!force && observedSelection && selected == observedTarget && design == observedDesign && scene == observedScene) return;
            observedSelection = true;
            observedTarget = selected;
            observedDesign = design;
            observedScene = scene;
            resolvedTarget = null;
            selectionRevision++;
            editing = new WorkshopEditState();
            RenderControls();
            rootVisualElement.Q<Label>("selection").text = selected == null ? "Select a generated scene root to rebuild." : "Selected: " + selected.name;
            if (operationKind == "catalog") return;
            Cancel();
            if (catalog == null) { SetBusy(IsBusy); return; }
            if (selected == null)
            {
                if (currentRecipe != null) editing.Fresh(currentRecipe);
                RenderControls();
                SetBusy(IsBusy);
                return;
            }
            var revision = selectionRevision;
            try
            {
                var request = new JObject { ["protocolVersion"] = 1, ["operation"] = "resolve", ["design"] = JObject.Parse(design) };
                var pending = Request("resolve", request, response =>
                {
                    if (SelectedRoot() != selected || selected == null || selected.DesignJson != design)
                        throw new OperationCanceledException("Selected root changed during resolution");
                    VerifySource(response);
                    var canonical = (JObject)response["design"];
                    SetRecipe((string)canonical["family"]);
                    editing.Load(currentRecipe, canonical);
                    SetPresetLabel("Saved design");
                    resolvedTarget = selected;
                    RenderControls();
                    Status((string)canonical["migration"]?["notice"] ?? "Saved design resolved. Controls are ready.");
                    return response;
                }, true);
                Observe(pending, revision);
            }
            catch (Exception exception) { SetBusy(IsBusy); Status(exception.Message); }
        }

        public Task<GeneratedAsset> BuildAsync(bool rebuild = false)
        {
            if (currentRecipe == null || !editing.IsReady) throw new InvalidOperationException("Load the catalog and resolve any selected design first");
            if (editing.Baseline != null && !IsSelectionResolved)
                throw new InvalidOperationException("The selected design changed. Select it again before generating assets");
            var selected = SelectedRoot();
            var design = selected == null ? null : selected.DesignJson;
            var target = rebuild ? selected : null;
            if (rebuild && !IsSelectionResolved) throw new InvalidOperationException("Resolve the selected scene root before rebuilding");
            var previousChild = target == null ? null : target.GeneratedChild;
            return Request("build", editing.BuildRequest(currentRecipe), response =>
            {
                if (SelectedRoot() != selected || (selected != null && selected.DesignJson != design)
                    || (rebuild && (target == null || target.GeneratedChild != previousChild)))
                    throw new OperationCanceledException("Scene or rebuild target changed during generation; previous asset retained");
                VerifySource(response);
                var next = new WorkshopEditState();
                next.Load(currentRecipe, (JObject)response["design"]);
                GeneratedAsset result;
                applyingBuild = true;
                try { result = WorkshopAssets.Apply(response, target); }
                finally { applyingBuild = false; }
                observedSelection = true;
                observedTarget = result;
                observedDesign = result.DesignJson;
                observedScene = SceneManager.GetActiveScene();
                resolvedTarget = result;
                editing = next;
                SetPresetLabel("Saved design");
                RenderControls();
                Status("Saved generated assets. Save the scene to retain this root. Undo is available.");
                return result;
            });
        }

        private void VerifySource(JObject response)
        {
            if ((string)response["sourceHash"] != (string)catalog["sourceHash"])
                throw new InvalidOperationException("Source changed. Reload the local catalog before generating assets.");
        }

        private Task<T> Request<T>(string kind, JObject request, Func<JObject, T> apply, bool replace = false, Action completed = null)
        {
            if (IsBusy && !replace) throw new InvalidOperationException("A Polyspoon operation is already running");
            if (replace) Cancel();
            var active = new CancellationTokenSource();
            operation = active;
            operationKind = kind;
            var revision = selectionRevision;
            var scene = SceneManager.GetActiveScene();
            var applied = false;
            SetBusy(true);
            Status(kind == "resolve" ? "Resolving saved design locally…" : "Working locally…");
            try
            {
                var pending = WorkshopBridge.RequestAsync(repositoryPath, nodeExecutable, request, active.Token);
                return WorkshopEditorCompletion.OnUpdate(pending, response =>
                {
                    active.Token.ThrowIfCancellationRequested();
                    if (this == null || !windowEnabled || !ReferenceEquals(operation, active)
                        || (kind != "catalog" && (revision != selectionRevision || SceneManager.GetActiveScene() != scene)))
                        throw new OperationCanceledException("Generation context changed; previous asset retained");
                    var result = apply(response);
                    applied = true;
                    return result;
                }, () =>
                {
                    var current = ReferenceEquals(operation, active);
                    EndOperation(active);
                    if (applied && current && this != null && windowEnabled) completed?.Invoke();
                });
            }
            catch { EndOperation(active); throw; }
        }

        private void EndOperation(CancellationTokenSource active)
        {
            if (ReferenceEquals(operation, active))
            {
                operation = null;
                operationKind = null;
                if (this != null && windowEnabled) SetBusy(false);
            }
            active.Dispose();
        }

        private void SetBusy(bool busy)
        {
            foreach (var name in new[] { "repository", "node", "connect" }) rootVisualElement.Q(name).SetEnabled(!busy);
            rootVisualElement.Q("recipe").SetEnabled(!busy && catalog != null);
            rootVisualElement.Q("preset").SetEnabled(!busy && editing.IsReady);
            rootVisualElement.Q("controls").SetEnabled(!busy && editing.IsReady);
            rootVisualElement.Q("build").SetEnabled(!busy && editing.IsReady);
            rootVisualElement.Q("rebuild").SetEnabled(!busy && IsSelectionResolved);
            rootVisualElement.Q<Button>("cancel").SetEnabled(busy);
        }

        private void Status(string text)
        {
            if (this != null && windowEnabled) rootVisualElement.Q<Label>("status").text = text;
        }
    }
}
