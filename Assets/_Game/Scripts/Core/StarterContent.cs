using System.Collections;
using UnityEngine;
using ZombieCafe.Cafe;
using ZombieCafe.Core;
using ZombieCafe.Data;
using ZombieCafe.Zombies;

namespace ZombieCafe.Core
{
    // On first run: gives the player a starter zombie and places a basic stove.
    // Skips silently if zombies already exist in the save.
    public class StarterContent : MonoBehaviour
    {
        void Start() => StartCoroutine(Setup());

        IEnumerator Setup()
        {
            // Wait two frames so all other Start() calls complete
            yield return null;
            yield return null;

            if (SaveSystem.Current.Zombies.Length > 0) yield break; // already set up

            AddStarterZombie();
            PlaceStarterStove();
            SaveSystem.Save();
        }

        void AddStarterZombie()
        {
            var inv = FindFirstObjectByType<ZombieInventory>();
            if (inv == null) return;

            // Try the first zombie in the catalog
            var all = Resources.LoadAll<ZombieData>("Zombies");
            if (all == null || all.Length == 0) return;

            var data = all[0];
            inv.AddZombie(data);

            EventBus.Publish(new NotificationEvent
            {
                Message  = $"{data.DisplayName} joined your cafe!",
                Duration = 4f
            });
        }

        void PlaceStarterStove()
        {
            var grid = GridManager.Instance;
            if (grid == null) return;

            // Find first open cell
            for (int y = 0; y < grid.Height; y++)
            for (int x = 0; x < grid.Width;  x++)
            {
                if (!grid.CanPlace(x, y, Vector2Int.one)) continue;

                var go = new GameObject("StarterStove");
                var pi = go.AddComponent<PlaceableItem>();
                pi.ItemId   = "starter_stove";
                pi.ItemType = "pot";
                pi.Size     = Vector2Int.one;

                if (!grid.TryPlaceExisting(go, x, y, Vector2Int.one))
                { Destroy(go); return; }

                // Visual
                var sr = go.AddComponent<SpriteRenderer>();
                sr.sprite       = MakeSprite();
                sr.color        = new Color(0.60f, 0.32f, 0.08f);
                sr.sortingOrder = 2;
                go.transform.localScale = new Vector3(0.88f, 0.44f, 1f);

                // Collider for tap detection
                go.AddComponent<BoxCollider2D>().size = Vector2.one;

                // Cooking station
                var station  = go.AddComponent<CookingStation>();
                station.Data = BuildEquipmentData();

                // "TAP" world-space label
                AttachLabel(go);

                EventBus.Publish(new NotificationEvent
                {
                    Message  = "Starter stove placed at top-left. Tap it to cook!",
                    Duration = 4f
                });
                return;
            }
        }

        static EquipmentData BuildEquipmentData()
        {
            var eq = ScriptableObject.CreateInstance<EquipmentData>();
            eq.EquipmentId   = "starter_stove";
            eq.DisplayName   = "Basic Stove";
            eq.MaxLevel      = 3;
            eq.UpgradeCost   = new[] { 200, 500 };
            eq.SpeedPerLevel = new[] { 1f, 0.8f, 0.6f };

            var dishes = Resources.LoadAll<DishData>("Dishes");
            int n      = dishes != null ? Mathf.Min(dishes.Length, 5) : 0;
            eq.Recipes = new DishData[n];
            for (int i = 0; i < n; i++) eq.Recipes[i] = dishes[i];
            return eq;
        }

        static void AttachLabel(GameObject parent)
        {
            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(parent.transform, false);
            var canvas = labelGo.AddComponent<Canvas>();
            canvas.renderMode  = RenderMode.WorldSpace;
            canvas.sortingOrder = 5;
            var rt = labelGo.GetComponent<RectTransform>();
            rt.localPosition = new Vector3(0f, 0.65f, 0f);
            rt.localScale    = Vector3.one * 0.008f;
            rt.sizeDelta     = new Vector2(180, 50);
            var tmp = labelGo.AddComponent<TMPro.TextMeshPro>();
            tmp.text      = "TAP";
            tmp.fontSize  = 26;
            tmp.alignment = TMPro.TextAlignmentOptions.Center;
            tmp.color     = new Color(1f, 0.85f, 0.3f);
        }

        static Sprite MakeSprite()
        {
            var tex = new Texture2D(2, 2);
            tex.SetPixels(new[] { Color.white, Color.white, Color.white, Color.white });
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, 2, 2), new Vector2(0.5f, 0.5f), 2f);
        }
    }
}
