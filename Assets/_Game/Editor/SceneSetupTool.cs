#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ZombieCafe.Editor
{
    // Menu: ZombieCafe > Setup Scenes
    // Run once after opening the project for the first time.
    // Populates Boot.unity and Main.unity with all required manager GameObjects.
    public static class SceneSetupTool
    {
        const string BOOT_PATH = "Assets/_Game/Scenes/Boot.unity";
        const string MAIN_PATH = "Assets/_Game/Scenes/Main.unity";

        [MenuItem("ZombieCafe/Setup Scenes")]
        public static void SetupScenes()
        {
            if (!EditorUtility.DisplayDialog("Setup Scenes",
                    "This will populate Boot.unity and Main.unity with manager GameObjects.\n" +
                    "Run once on a fresh project. Continue?", "Yes", "Cancel"))
                return;

            SetupBoot();
            SetupMain();
            SetupBuildSettings();

            EditorUtility.DisplayDialog("Done",
                "Boot and Main scenes are set up.\n" +
                "Next: run  python Tools/generate_so_catalog.py  then press Play.",
                "OK");
        }

        // Silent version — no dialogs, safe to call from automation.
        public static void SetupScenesQuiet()
        {
            SetupBoot();
            SetupMain();
            SetupBuildSettings();
            Debug.Log("[SceneSetup] Silent setup complete.");
        }

        // ── Boot scene ────────────────────────────────────────────────────────

        static void SetupBoot()
        {
            var scene = EditorSceneManager.OpenScene(BOOT_PATH, OpenSceneMode.Single);

            // Remove everything that already exists (idempotent re-run)
            foreach (var go in scene.GetRootGameObjects())
                Object.DestroyImmediate(go);

            // BootstrapManager
            var boot = new GameObject("BootstrapManager");
            boot.AddComponent<ZombieCafe.Core.BootstrapManager>();

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, BOOT_PATH);
            Debug.Log("[SceneSetup] Boot.unity saved.");
        }

        // ── Main scene ────────────────────────────────────────────────────────

        static void SetupMain()
        {
            var scene = EditorSceneManager.OpenScene(MAIN_PATH, OpenSceneMode.Single);

            foreach (var go in scene.GetRootGameObjects())
                Object.DestroyImmediate(go);

            // ── Core managers ──────────────────────────────────────────────
            AddManager<ZombieCafe.Core.GameManager>(scene,        "GameManager");

            // ── Cafe ───────────────────────────────────────────────────────
            AddManager<ZombieCafe.Cafe.CafeManager>(scene,        "CafeManager");
            AddManager<ZombieCafe.Cafe.GridManager>(scene,        "GridManager");
            AddManager<ZombieCafe.Cafe.CafeExpansion>(scene,      "CafeExpansion");

            // ── Economy ────────────────────────────────────────────────────
            AddManager<ZombieCafe.Economy.CurrencyManager>(scene, "CurrencyManager");
            AddManager<ZombieCafe.Economy.ShopManager>(scene,     "ShopManager");
            AddManager<ZombieCafe.Economy.BoosterManager>(scene,  "BoosterManager");

            // ── Zombies ────────────────────────────────────────────────────
            AddManager<ZombieCafe.Zombies.ZombieInventory>(scene, "ZombieInventory");
            AddManager<ZombieCafe.Cafe.MeatLocker>(scene,         "MeatLocker");

            // ── Combat ─────────────────────────────────────────────────────
            AddManager<ZombieCafe.Combat.CafeDefenseManager>(scene, "CafeDefenseManager");

            // ── Input handler ──────────────────────────────────────────────
            AddManager<ZombieCafe.Input.CafeInputHandler>(scene, "CafeInputHandler");

            // ── Grid floor renderer ────────────────────────────────────────
            AddManager<ZombieCafe.Cafe.GridFloorRenderer>(scene, "GridFloorRenderer");

            // ── Starter content (first-run zombie + stove) ────────────────
            AddManager<ZombieCafe.Core.StarterContent>(scene, "StarterContent");

            // ── Runtime UI (builds all UI in Play mode) ───────────────────
            AddManager<ZombieCafe.UI.GameUIRoot>(scene, "GameUIRoot");

            // ── UI Canvas (notification manager — null-safe without prefab) ──
            var canvas = new GameObject("UICanvas");
            canvas.AddComponent<ZombieCafe.UI.NotificationManager>();
            SceneManager.MoveGameObjectToScene(canvas, scene);

            // ── Camera ─────────────────────────────────────────────────────
            var cam = new GameObject("Main Camera");
            var camComp = cam.AddComponent<Camera>();
            camComp.orthographic     = true;
            camComp.orthographicSize = 5f;
            camComp.backgroundColor  = new Color(0.1f, 0.08f, 0.08f);
            cam.tag = "MainCamera";
            SceneManager.MoveGameObjectToScene(cam, scene);

            // ── Directional light ──────────────────────────────────────────
            var lightGo = new GameObject("Directional Light");
            var light   = lightGo.AddComponent<Light>();
            light.type      = LightType.Directional;
            light.intensity = 1f;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            SceneManager.MoveGameObjectToScene(lightGo, scene);

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, MAIN_PATH);
            Debug.Log("[SceneSetup] Main.unity saved.");
        }

        // ── Build settings ────────────────────────────────────────────────────

        static void SetupBuildSettings()
        {
            var scenes = new[]
            {
                new EditorBuildSettingsScene(BOOT_PATH, true),
                new EditorBuildSettingsScene(MAIN_PATH, true),
            };
            EditorBuildSettings.scenes = scenes;
            Debug.Log("[SceneSetup] Build settings updated: Boot(0), Main(1).");
        }

        // ── Helper ────────────────────────────────────────────────────────────

        static void AddManager<T>(Scene scene, string name) where T : Component
        {
            // Check if type is actually available — if not, skip gracefully
            var go = new GameObject(name);
            try { go.AddComponent<T>(); }
            catch
            {
                Debug.LogWarning($"[SceneSetup] Could not add {typeof(T).Name} — skipping.");
                Object.DestroyImmediate(go);
                return;
            }
            SceneManager.MoveGameObjectToScene(go, scene);
        }
    }
}
#endif
