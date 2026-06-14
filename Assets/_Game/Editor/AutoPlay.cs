#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace ZombieCafe.Editor
{
    // Re-runs scene setup and enters Play mode on every domain reload.
    // Skips if already playing or still compiling.
    [InitializeOnLoad]
    public static class AutoPlay
    {
        static AutoPlay()
        {
            EditorApplication.delayCall += Run;
        }

        static void Run()
        {
            EditorApplication.delayCall -= Run;

            // Never enter Play mode in headless CI builds (-batchmode), or scripted
            // builds via -executeMethod would be hijacked and never produce output.
            if (Application.isBatchMode) return;

            if (EditorApplication.isCompiling || EditorApplication.isPlaying) return;

            try
            {
                SceneSetupTool.SetupScenesQuiet();
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"[AutoPlay] Scene setup error: {e.Message}");
            }

            EditorApplication.isPlaying = true;
        }
    }
}
#endif
