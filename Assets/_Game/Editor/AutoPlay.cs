#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

namespace ZombieCafe.Editor
{
    // Automatically sets up scenes and enters Play mode once per editor session.
    // Fires on the first domain reload after the editor opens.
    [InitializeOnLoad]
    public static class AutoPlay
    {
        const string SESSION_KEY = "ZombieCafe.AutoPlayDone";

        static AutoPlay()
        {
            if (SessionState.GetBool(SESSION_KEY, false)) return;
            EditorApplication.delayCall += Run;
        }

        static void Run()
        {
            EditorApplication.delayCall -= Run;

            // Wait out any in-progress compilation
            if (EditorApplication.isCompiling)
            {
                EditorApplication.delayCall += Run;
                return;
            }

            SessionState.SetBool(SESSION_KEY, true);

            try
            {
                SceneSetupTool.SetupScenesQuiet();
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"[AutoPlay] Scene setup failed: {e.Message}. Entering Play anyway.");
            }

            EditorApplication.isPlaying = true;
        }
    }
}
#endif
