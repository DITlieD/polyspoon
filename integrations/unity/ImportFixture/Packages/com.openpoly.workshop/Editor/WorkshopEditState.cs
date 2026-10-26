using System;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace OpenPoly.Workshop.Editor
{
    internal sealed class WorkshopEditState
    {
        public JObject Baseline { get; private set; }
        public JObject Parameters { get; private set; }
        public bool IsReady => Parameters != null;

        public void Fresh(JObject recipe)
        {
            Baseline = null;
            Parameters = (JObject)recipe["defaults"].DeepClone();
        }

        public void Load(JObject recipe, JObject design)
        {
            if (design == null || (int?)design["formatVersion"] != 1
                || (string)design["family"] != (string)recipe["id"]
                || (string)design["familyVersion"] != (string)recipe["version"]
                || !(design["applied"] is JObject applied))
                throw new InvalidOperationException("Canonical design does not match the loaded recipe; reload the catalog");
            var values = new JObject();
            foreach (JObject control in (JArray)recipe["controls"])
            {
                var key = (string)control["key"];
                if (applied[key] == null) throw new InvalidOperationException("Canonical design is missing control " + key);
                values[key] = applied[key].DeepClone();
            }
            Baseline = (JObject)design.DeepClone();
            Parameters = values;
        }

        public void Preset(JObject recipe, JObject preset)
        {
            Parameters = (JObject)recipe["defaults"].DeepClone();
            if (preset != null) Parameters.Merge(preset["parameters"]);
        }

        public JObject Edits(JObject recipe)
        {
            if (!IsReady) throw new InvalidOperationException("Resolve the selected design before editing");
            var keys = ((JArray)recipe["controls"]).Select(control => (string)control["key"]).ToArray();
            if (Parameters.Properties().Any(property => !keys.Contains(property.Name)))
                throw new InvalidOperationException("Only recipe controls may be edited");
            var result = new JObject();
            foreach (var key in keys)
            {
                if (Parameters[key] == null) throw new InvalidOperationException("Missing control " + key);
                if (Baseline == null || !JToken.DeepEquals(Parameters[key], Baseline["applied"][key]))
                    result[key] = Parameters[key].DeepClone();
            }
            return result;
        }

        public JObject BuildRequest(JObject recipe)
        {
            var edits = Edits(recipe);
            if (Baseline != null)
                return new JObject { ["protocolVersion"] = 1, ["operation"] = "build",
                    ["design"] = Baseline.DeepClone(), ["edits"] = edits };
            return new JObject { ["protocolVersion"] = 1, ["operation"] = "build",
                ["family"] = (string)recipe["id"], ["parameters"] = edits };
        }
    }
}
