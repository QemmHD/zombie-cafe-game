using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ZombieCafe.Editor
{
    /// <summary>
    /// One-click setup: creates Boot and Main scenes, adds all manager GameObjects,
    /// registers them in Build Settings, and saves everything.
    ///
    /// Menu: ZombieCafe > Setup Scenes (run once after first Unity import)
    /// </summary>
    public static class SceneSetupTool
    {
        const string BOOT_PATH = "Assets/_Game/Scenes/Boot.unity";
        const string MAIN_PATH = "Assets/_Game/Scenes/Main.unity";

        [MenuItem("ZombieCafe/Setup Scenes")]
        public static void SetupScenes()
        {
            // Ensure asset folders exist
            EnsureFolder("Assets/_Game/Scenes");
            EnsureFolder("Assets/_Game/Resources");

            SetupBootScene();
            SetupMainScene();
            RegisterBuildSettings();

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("[SceneSetupTool] Done! Open Boot or Main scene and press Play.");
        }

        // ── Boot scene ────────────────────────────────────────────────────────

        static void SetupBootScene()
        {
            var scene = CreateOrLoadScene(BOOT_PATH);

            // Clear any existing GameObjects
            foreach (var go in scene.GetRootGameObjects())
                Object.DestroyImmediate(go);

            // BootstrapManager
            AddComponent<ZombieCafe.Core.BootstrapManager>(scene, "Bootstrap");

            EditorSceneManager.SaveScene(scene, BOOT_PATH);
            Debug.Log("[SceneSetupTool] Boot scene saved.");
        }

        // ── Main scene ────────────────────────────────────────────────────────

        static void SetupMainScene()
        {
            var scene = CreateOrLoadScene(MAIN_PATH);

            foreach (var go in scene.GetRootGameObjects())
                Object.DestroyImmediate(go);

            // Camera
            var camGO = new GameObject("Main Camera");
            SceneManager.MoveGameObjectToScene(camGO, scene);
            var cam = camGO.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 5f;
            cam.backgroundColor = new Color(0.1f, 0.12f, 0.1f);
            cam.transform.position = new Vector3(0, 0, -10);
            camGO.tag = "MainCamera";
            camGO.AddComponent<AudioListener>();

            // --- Core managers ---
            AddComponent<ZombieCafe.Core.GameManager>(scene,      "GameManager");
            AddComponent<ZombieCafe.Core.EventBus>(scene,         "EventBus");       // static class but harmless empty GO
            AddComponent<ZombieCafe.Core.SaveSystem>(scene,       "SaveSystem");

            // --- Cafe systems ---
            AddComponent<ZombieCafe.Cafe.GridManager>(scene,      "GridManager");

            // --- Economy ---
            AddComponent<ZombieCafe.Economy.CurrencyManager>(scene,   "CurrencyManager");
            AddComponent<ZombieCafe.Economy.ZombieRoster>(scene,      "ZombieRoster");
            AddComponent<ZombieCafe.Economy.MeatLocker>(scene,        "MeatLocker");
            AddComponent<ZombieCafe.Economy.CafeExpansion>(scene,     "CafeExpansion");
            AddComponent<ZombieCafe.Economy.BoosterManager>(scene,    "BoosterManager");
            AddComponent<ZombieCafe.Economy.TombstoneManager>(scene,  "TombstoneManager");
            AddComponent<ZombieCafe.Economy.ShopManager>(scene,       "ShopManager");

            // --- Combat ---
            AddComponent<ZombieCafe.Combat.CafeDefenseManager>(scene, "CafeDefenseManager");

            // --- Input ---
            AddComponent<ZombieCafe.Input.CafeInputHandler>(scene,    "CafeInputHandler");

            // --- UI root ---
            var uiRoot = new GameObject("UI");
            SceneManager.MoveGameObjectToScene(uiRoot, scene);

            AddComponentUnderParent<ZombieCafe.UI.NotificationManager>(uiRoot, "NotificationManager");
            AddComponentUnderParent<ZombieCafe.UI.ShopUI>(uiRoot,             "ShopUI");
            AddComponentUnderParent<ZombieCafe.UI.MeatLockerUI>(uiRoot,       "MeatLockerUI");
            AddComponentUnderParent<ZombieCafe.UI.CafeExpansionUI>(uiRoot,    "CafeExpansionUI");
            AddComponentUnderParent<ZombieCafe.UI.PlacementUI>(uiRoot,        "PlacementUI");

            EditorSceneManager.SaveScene(scene, MAIN_PATH);
            Debug.Log("[SceneSetupTool] Main scene saved.");
        }

        // ── Build Settings ────────────────────────────────────────────────────

        static void RegisterBuildSettings()
        {
            var scenes = new[]
            {
                new EditorBuildSettingsScene(BOOT_PATH, true),
                new EditorBuildSettingsScene(MAIN_PATH, true),
            };
            EditorBuildSettings.scenes = scenes;
            Debug.Log("[SceneSetupTool] Build Settings updated: Boot (index 0), Main (index 1).");
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        static Scene CreateOrLoadScene(string path)
        {
            // If the scene asset exists, open it; otherwise create new
            var asset = AssetDatabase.LoadAssetAtPath<SceneAsset>(path);
            if (asset != null)
                return EditorSceneManager.OpenScene(path, OpenSceneMode.Single);

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, path);
            AssetDatabase.ImportAsset(path);
            return scene;
        }

        static GameObject AddComponent<T>(Scene scene, string name) where T : Component
        {
            var go = new GameObject(name);
            SceneManager.MoveGameObjectToScene(go, scene);
            go.AddComponent<T>();
            return go;
        }

        static GameObject AddComponentUnderParent<T>(GameObject parent, string name) where T : Component
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent.transform, false);
            go.AddComponent<T>();
            return go;
        }

        static void EnsureFolder(string path)
        {
            var parts = path.Split('/');
            var current = parts[0];
            for (int i = 1; i < parts.Length; i++)
            {
                var next = current + "/" + parts[i];
                if (!AssetDatabase.IsValidFolder(next))
                    AssetDatabase.CreateFolder(current, parts[i]);
                current = next;
            }
        }
    }
}
