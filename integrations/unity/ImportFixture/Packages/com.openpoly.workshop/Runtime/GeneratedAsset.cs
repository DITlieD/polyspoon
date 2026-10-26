using UnityEngine;

namespace OpenPoly.Workshop
{
    [DisallowMultipleComponent]
    public sealed class GeneratedAsset : MonoBehaviour
    {
        [SerializeField] private string family;
        [SerializeField] private string recipeVersion;
        [SerializeField] private string designJson;
        [SerializeField] private string sourceHash;
        [SerializeField] private string assetPath;
        [SerializeField] private Transform generatedChild;

        public string Family => family;
        public string RecipeVersion => recipeVersion;
        public string DesignJson => designJson;
        public string SourceHash => sourceHash;
        public string AssetPath => assetPath;
        public Transform GeneratedChild => generatedChild;

        public void SetIdentity(string newFamily, string newVersion, string newDesign, string newSource, string newPath, Transform child)
        {
            family = newFamily;
            recipeVersion = newVersion;
            designJson = newDesign;
            sourceHash = newSource;
            assetPath = newPath;
            generatedChild = child;
        }
    }
}
