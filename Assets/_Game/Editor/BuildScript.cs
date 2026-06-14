#if UNITY_EDITOR
using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace ZombieCafe.Editor
{
    // Headless build entry points invoked from CI via -executeMethod.
    // The iOS path produces an Xcode project (Unity cannot emit an .ipa directly);
    // the .github workflow then archives + exports it into the final .ipa on macOS.
    public static class BuildScript
    {
        // Called as: Unity -batchmode -quit -executeMethod ZombieCafe.Editor.BuildScript.BuildIOS
        public static void BuildIOS()
        {
            string outputPath = ArgValue("-buildOutput", "build/iOS");

            var options = new BuildPlayerOptions
            {
                scenes           = EnabledScenes(),
                locationPathName = outputPath,
                target           = BuildTarget.iOS,
                targetGroup      = BuildTargetGroup.iOS,
                options          = BuildOptions.None,
            };

            BuildReport report = BuildPipeline.BuildPlayer(options);
            BuildSummary summary = report.summary;

            Debug.Log($"[BuildScript] iOS build {summary.result} — {summary.totalSize} bytes at {summary.outputPath}");

            if (summary.result != BuildResult.Succeeded)
            {
                // Non-zero exit so the CI job fails loudly instead of "succeeding" with no output.
                EditorApplication.Exit(1);
            }
        }

        static string[] EnabledScenes()
        {
            var scenes = EditorBuildSettings.scenes
                .Where(s => s.enabled)
                .Select(s => s.path)
                .ToArray();

            if (scenes.Length == 0)
                throw new Exception("[BuildScript] No enabled scenes in EditorBuildSettings — nothing to build.");

            return scenes;
        }

        static string ArgValue(string flag, string fallback)
        {
            string[] args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == flag)
                    return args[i + 1];
            return fallback;
        }
    }
}
#endif
