using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using ZombieCafe.Cafe;
using ZombieCafe.Core;
using ZombieCafe.Data;
using ZombieCafe.Economy;
using ZombieCafe.Zombies;

namespace ZombieCafe.UI
{
    // Builds the entire playable UI at runtime - no prefabs, no inspector wiring.
    // Handles: HUD, shop, zombie assignment, notification toasts, grid placement.
    public class GameUIRoot : MonoBehaviour
    {
        // ── Runtime refs ──────────────────────────────────────────────────────
        CurrencyManager _currency;
        ZombieInventory _inventory;
        Canvas          _canvas;

        // HUD
        TextMeshProUGUI _coinsLabel;
        TextMeshProUGUI _brainsLabel;

        // Notification
        Transform       _notifRoot;

        // Shop
        GameObject      _shopPanel;
        Transform       _shopList;
        ShopTab         _currentTab = ShopTab.Zombies;

        // Assign panel
        GameObject      _assignPanel;
        Transform       _assignList;
        CookingStation  _pendingStation;

        // Loaded assets
        ZombieData[]    _zombieCatalog;
        FurnitureData[] _furnitureCatalog;
        DishData[]      _dishCatalog;

        enum ShopTab { Zombies, Furniture }

        // ── Lifecycle ─────────────────────────────────────────────────────────

        void Start()
        {
            _currency  = FindFirstObjectByType<CurrencyManager>();
            _inventory = FindFirstObjectByType<ZombieInventory>();

            LoadAssets();
            EnsureEventSystem();
            BuildCanvas();
            BuildHUD();
            BuildNotificationArea();
            BuildShopPanel();
            BuildAssignPanel();
            BuildBottomBar();   // built last so it renders on top

            if (_currency != null)
            {
                _currency.OnCoinsChanged  += c => UpdateHUD();
                _currency.OnBrainsChanged += b => UpdateHUD();
                UpdateHUD();
            }

            EventBus.Subscribe<NotificationEvent>(OnNotification);
            EventBus.Subscribe<StationSelectedEvent>(OnStationSelected);

            EventBus.Publish(new NotificationEvent
            {
                Message  = "Welcome to Zombie Cafe! Tap Shop to get started.",
                Duration = 4f
            });
        }

        void OnDestroy()
        {
            EventBus.Unsubscribe<NotificationEvent>(OnNotification);
            EventBus.Unsubscribe<StationSelectedEvent>(OnStationSelected);
        }

        void UpdateHUD()
        {
            if (_currency == null) return;
            _coinsLabel.text  = $"Coins: {_currency.Coins:N0}";
            _brainsLabel.text = $"Brains: {_currency.Brains}";
        }

        void LoadAssets()
        {
            _zombieCatalog    = Resources.LoadAll<ZombieData>("Zombies");
            _furnitureCatalog = Resources.LoadAll<FurnitureData>("Furniture");
            _dishCatalog      = Resources.LoadAll<DishData>("Dishes");
        }

        // ── Canvas ────────────────────────────────────────────────────────────

        void BuildCanvas()
        {
            var go   = new GameObject("GameUI");
            _canvas  = go.AddComponent<Canvas>();
            _canvas.renderMode   = RenderMode.ScreenSpaceOverlay;
            _canvas.sortingOrder = 100;

            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode         = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight  = 0.5f;

            go.AddComponent<GraphicRaycaster>();
        }

        // ── HUD (top bar) ─────────────────────────────────────────────────────

        void BuildHUD()
        {
            var bar = MakePanel(_canvas.transform, new Color(0.08f, 0.05f, 0.05f, 0.92f));
            Anchor(bar, 0, 1, 1, 1, new Vector2(0, -80), Vector2.zero);

            _coinsLabel  = MakeText(bar.transform, "Coins: 500", 26);
            Anchor(_coinsLabel, 0.02f, 0, 0.5f, 1, Vector2.zero, Vector2.zero);
            _coinsLabel.alignment  = TextAlignmentOptions.MidlineLeft;
            _coinsLabel.color      = new Color(1f, 0.9f, 0.3f);

            _brainsLabel = MakeText(bar.transform, "Brains: 10", 26);
            Anchor(_brainsLabel, 0.5f, 0, 0.98f, 1, Vector2.zero, Vector2.zero);
            _brainsLabel.alignment = TextAlignmentOptions.MidlineRight;
            _brainsLabel.color     = new Color(0.6f, 1f, 0.6f);

            var lvl = MakeText(bar.transform, $"Cafe Lv.{SaveSystem.Current.CafeLevel}", 20);
            Anchor(lvl, 0.38f, 0, 0.62f, 1, Vector2.zero, Vector2.zero);
            lvl.alignment = TextAlignmentOptions.Center;
            lvl.color     = new Color(1f, 0.7f, 0.7f);
        }

        // ── Notifications ─────────────────────────────────────────────────────

        void BuildNotificationArea()
        {
            var go = new GameObject("Notif_Root");
            go.transform.SetParent(_canvas.transform, false);
            _notifRoot = go.transform;
            var rt  = go.AddComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.05f, 0.75f);
            rt.anchorMax = new Vector2(0.95f, 0.94f);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var vlg = go.AddComponent<VerticalLayoutGroup>();
            vlg.childAlignment       = TextAnchor.UpperCenter;
            vlg.spacing              = 4f;
            vlg.childControlHeight   = false;
            vlg.childForceExpandHeight = false;
            vlg.childForceExpandWidth  = true;
        }

        void OnNotification(NotificationEvent e)
        {
            StartCoroutine(ShowToast(e.Message, e.Duration > 0f ? e.Duration : 2f));
        }

        IEnumerator ShowToast(string msg, float dur)
        {
            var go  = MakePanel(_notifRoot, new Color(0.12f, 0.08f, 0.08f, 0.93f));
            go.name = "Toast";
            var rt  = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(0, 48);
            var txt = MakeText(go.transform, msg, 20);
            Anchor(txt, 0, 0, 1, 1, new Vector2(8, 0), new Vector2(-8, 0));
            txt.alignment = TextAlignmentOptions.Center;
            var cg = go.AddComponent<CanvasGroup>();
            cg.alpha = 0f;

            float t = 0f;
            while (t < 0.18f) { t += Time.deltaTime; cg.alpha = t / 0.18f; yield return null; }
            cg.alpha = 1f;
            yield return new WaitForSeconds(dur);
            t = 0f;
            while (t < 0.25f) { t += Time.deltaTime; cg.alpha = 1f - t / 0.25f; yield return null; }
            Destroy(go);
        }

        // ── Bottom Bar ────────────────────────────────────────────────────────

        void BuildBottomBar()
        {
            var bar = MakePanel(_canvas.transform, new Color(0.08f, 0.05f, 0.05f, 0.95f));
            Anchor(bar, 0, 0, 1, 0, Vector2.zero, new Vector2(0, 90));

            var hlg = bar.AddComponent<HorizontalLayoutGroup>();
            hlg.childAlignment      = TextAnchor.MiddleCenter;
            hlg.spacing             = 16;
            hlg.padding             = new RectOffset(20, 20, 12, 12);
            hlg.childForceExpandWidth  = true;
            hlg.childForceExpandHeight = true;

            MakeButton(bar.transform, "Shop",     OpenShop,  new Color(0.55f, 0.18f, 0.05f));
            MakeButton(bar.transform, "Zombies",  () => { OpenShop(); SwitchTab(ShopTab.Zombies); },
                       new Color(0.15f, 0.35f, 0.12f));
            MakeButton(bar.transform, "Furniture",() => { OpenShop(); SwitchTab(ShopTab.Furniture); },
                       new Color(0.18f, 0.25f, 0.4f));
        }

        // ── Shop Panel ────────────────────────────────────────────────────────

        void BuildShopPanel()
        {
            _shopPanel = MakePanel(_canvas.transform, new Color(0.07f, 0.05f, 0.05f, 0.97f));
            Anchor(_shopPanel.transform, 0, 0.09f, 1, 0.91f, Vector2.zero, Vector2.zero);
            _shopPanel.SetActive(false);

            // Header
            var hdr   = MakePanel(_shopPanel.transform, new Color(0.18f, 0.08f, 0.08f, 1f));
            Anchor(hdr.transform, 0, 1, 1, 1, new Vector2(0, -65), Vector2.zero);
            var ttl   = MakeText(hdr.transform, "SHOP", 32);
            Anchor(ttl, 0.05f, 0, 0.85f, 1, Vector2.zero, Vector2.zero);
            ttl.alignment = TextAlignmentOptions.MidlineLeft;
            ttl.fontStyle = FontStyles.Bold;
            var closeBtn = MakeButton(hdr.transform, "X", CloseShop, new Color(0.4f, 0.1f, 0.1f));
            Anchor(closeBtn.transform, 0.86f, 0.1f, 0.99f, 0.9f, Vector2.zero, Vector2.zero);

            // Tabs
            var tabs  = MakePanel(_shopPanel.transform, new Color(0.12f, 0.07f, 0.07f, 1f));
            Anchor(tabs.transform, 0, 1, 1, 1, new Vector2(0, -110), new Vector2(0, -65));
            var tabHlg = tabs.AddComponent<HorizontalLayoutGroup>();
            tabHlg.childForceExpandWidth  = true;
            tabHlg.childForceExpandHeight = true;
            tabHlg.spacing = 2;
            MakeButton(tabs.transform, "Zombies",   () => SwitchTab(ShopTab.Zombies),   new Color(0.2f, 0.35f, 0.15f));
            MakeButton(tabs.transform, "Furniture",  () => SwitchTab(ShopTab.Furniture), new Color(0.15f, 0.2f, 0.38f));

            // Scroll view
            var sv = new GameObject("ShopScroll");
            sv.transform.SetParent(_shopPanel.transform, false);
            var svRt = sv.AddComponent<RectTransform>();
            svRt.anchorMin = Vector2.zero;
            svRt.anchorMax = Vector2.one;
            svRt.offsetMin = new Vector2(0, 0);
            svRt.offsetMax = new Vector2(0, -110);
            var sr = sv.AddComponent<ScrollRect>();
            sr.horizontal = false;

            var vp = MakePanel(sv.transform, Color.clear);
            vp.name = "Viewport";
            Anchor(vp.transform, 0, 0, 1, 1, Vector2.zero, Vector2.zero);
            vp.AddComponent<Mask>().showMaskGraphic = false;
            sr.viewport = vp.GetComponent<RectTransform>();

            var content = new GameObject("Content");
            content.transform.SetParent(vp.transform, false);
            _shopList   = content.transform;
            var cRt     = content.AddComponent<RectTransform>();
            cRt.anchorMin = new Vector2(0, 1);
            cRt.anchorMax = new Vector2(1, 1);
            cRt.pivot     = new Vector2(0.5f, 1);
            cRt.offsetMin = cRt.offsetMax = Vector2.zero;
            var cvlg = content.AddComponent<VerticalLayoutGroup>();
            cvlg.spacing              = 3;
            cvlg.padding              = new RectOffset(8, 8, 4, 4);
            cvlg.childControlHeight   = false;
            cvlg.childForceExpandWidth = true;
            var csf = content.AddComponent<ContentSizeFitter>();
            csf.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.content = cRt;
        }

        // ── Assign Panel ──────────────────────────────────────────────────────

        void BuildAssignPanel()
        {
            _assignPanel = MakePanel(_canvas.transform, new Color(0.07f, 0.05f, 0.05f, 0.97f));
            Anchor(_assignPanel.transform, 0.05f, 0.28f, 0.95f, 0.72f, Vector2.zero, Vector2.zero);
            _assignPanel.SetActive(false);

            var hdr  = MakePanel(_assignPanel.transform, new Color(0.18f, 0.08f, 0.08f, 1f));
            Anchor(hdr.transform, 0, 1, 1, 1, new Vector2(0, -55), Vector2.zero);
            var ttl  = MakeText(hdr.transform, "Assign Zombie to Cook", 22);
            Anchor(ttl, 0.02f, 0, 0.82f, 1, Vector2.zero, Vector2.zero);
            ttl.alignment = TextAlignmentOptions.MidlineLeft;
            var closeBtn = MakeButton(hdr.transform, "X", CloseAssignPanel, new Color(0.4f, 0.1f, 0.1f));
            Anchor(closeBtn.transform, 0.83f, 0.1f, 0.99f, 0.9f, Vector2.zero, Vector2.zero);

            var listGo  = new GameObject("AssignList");
            listGo.transform.SetParent(_assignPanel.transform, false);
            _assignList = listGo.transform;
            var rt  = listGo.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(8, 8);
            rt.offsetMax = new Vector2(-8, -58);
            var vlg = listGo.AddComponent<VerticalLayoutGroup>();
            vlg.spacing              = 6;
            vlg.childControlHeight   = false;
            vlg.childForceExpandWidth = true;
        }

        // ── Shop Logic ────────────────────────────────────────────────────────

        void OpenShop()
        {
            _shopPanel.SetActive(true);
            SwitchTab(_currentTab);
        }

        void CloseShop() => _shopPanel.SetActive(false);

        void SwitchTab(ShopTab tab)
        {
            _currentTab = tab;
            foreach (Transform c in _shopList) Destroy(c.gameObject);
            if (tab == ShopTab.Zombies)   PopulateZombies();
            else                           PopulateFurniture();
        }

        void PopulateZombies()
        {
            if (_zombieCatalog == null || _zombieCatalog.Length == 0)
            { MakeShopRow("No zombie data loaded", "", null); return; }

            int shown = 0;
            foreach (var z in _zombieCatalog)
            {
                if (shown++ >= 25) break;
                var data    = z;
                string cost = $"{data.UnlockCost} {(data.CostInBrains ? "Brains" : "Coins")}";
                MakeShopRow(data.DisplayName, cost, () =>
                {
                    if (ShopManager.Instance == null) return;
                    bool ok = ShopManager.Instance.BuyZombie(data);
                    EventBus.Publish(new NotificationEvent
                    {
                        Message  = ok ? $"Hired {data.DisplayName}!" : "Not enough currency or roster full.",
                        Duration = 2.5f
                    });
                });
            }
        }

        void PopulateFurniture()
        {
            if (_furnitureCatalog == null || _furnitureCatalog.Length == 0)
            { MakeShopRow("No furniture data loaded", "", null); return; }

            int shown = 0;
            foreach (var f in _furnitureCatalog)
            {
                if (shown++ >= 25) break;
                var data    = f;
                string cost = $"{data.BuyCost} Coins";
                if (data.CafeLevelRequired > 1) cost += $" (Lv.{data.CafeLevelRequired})";
                MakeShopRow(data.DisplayName, cost, () =>
                {
                    if (ShopManager.Instance == null) return;
                    var item = ShopManager.Instance.BuyFurniture(data);
                    if (item == null) return;
                    CloseShop();
                    PlaceOnGrid(item, data);
                });
            }
        }

        void PlaceOnGrid(PlaceableItem item, FurnitureData data)
        {
            var grid = GridManager.Instance;
            if (grid == null) { Destroy(item.gameObject); return; }

            // Find first free cell
            for (int y = 0; y < grid.Height; y++)
            for (int x = 0; x < grid.Width;  x++)
            {
                if (!grid.CanPlace(x, y, item.Size)) continue;

                grid.TryPlaceExisting(item.gameObject, x, y, item.Size);

                // Add sprite renderer
                var sr = item.gameObject.AddComponent<SpriteRenderer>();
                sr.sprite       = SolidSprite();
                sr.color        = FurnitureColor(item.ItemType);
                sr.sortingOrder = 2;
                item.gameObject.transform.localScale = new Vector3(
                    item.Size.x * 0.88f, item.Size.y * 0.44f, 1f);

                // Collider for tapping
                var col  = item.gameObject.AddComponent<BoxCollider2D>();
                col.size = Vector2.one;

                // Cooking stations get a CookingStation component
                bool isStation = item.ItemType == "stove" || item.ItemType == "pot";
                if (isStation)
                {
                    var station = item.gameObject.AddComponent<CookingStation>();
                    station.Data = MakeEquipmentData();
                    AddStationLabel(item.gameObject);
                }

                EventBus.Publish(new NotificationEvent
                {
                    Message  = $"{data.DisplayName} placed! {(isStation ? "Tap it to assign a zombie." : "")}",
                    Duration = 3f
                });
                return;
            }

            EventBus.Publish(new NotificationEvent { Message = "No free space to place item!", Duration = 2f });
            Destroy(item.gameObject);
        }

        // ── Station Assignment ────────────────────────────────────────────────

        void OnStationSelected(StationSelectedEvent e)
        {
            _pendingStation = e.Station;
            PopulateAssignPanel();
            _assignPanel.SetActive(true);
        }

        void PopulateAssignPanel()
        {
            foreach (Transform c in _assignList) Destroy(c.gameObject);
            if (_inventory == null) return;

            var idle = _inventory.Zombies.FindAll(z => z.Assignment == "idle");
            if (idle.Count == 0)
            {
                var noRow = MakeAssignRow("No idle zombies — hire more in Shop", "", null);
                return;
            }

            // Pick the first dish the station can cook
            DishData dish = null;
            if (_pendingStation?.Data?.Recipes != null && _pendingStation.Data.Recipes.Length > 0)
                dish = _pendingStation.Data.Recipes[0];
            else if (_dishCatalog != null && _dishCatalog.Length > 0)
                dish = _dishCatalog[0];

            foreach (var zombie in idle)
            {
                var z = zombie;
                var d = dish;
                string dishName = d != null ? $"Cook {d.DisplayName}" : "No dish available";
                MakeAssignRow(
                    $"{z.Data.DisplayName} Lv.{z.Level}",
                    dishName,
                    () =>
                    {
                        if (d == null)
                        {
                            EventBus.Publish(new NotificationEvent { Message = "No dish to cook!", Duration = 2f });
                        }
                        else
                        {
                            bool ok = _pendingStation != null && _pendingStation.AssignZombie(z, d);
                            EventBus.Publish(new NotificationEvent
                            {
                                Message  = ok
                                    ? $"{z.Data.DisplayName} is cooking {d.DisplayName}!"
                                    : "Couldn't assign zombie.",
                                Duration = 2.5f
                            });
                        }
                        CloseAssignPanel();
                    });
            }
        }

        void CloseAssignPanel()
        {
            _assignPanel.SetActive(false);
            _pendingStation = null;
        }

        // ── Helpers — EquipmentData ───────────────────────────────────────────

        static EquipmentData MakeEquipmentData()
        {
            var eq = ScriptableObject.CreateInstance<EquipmentData>();
            eq.EquipmentId   = "runtime_stove";
            eq.DisplayName   = "Stove";
            eq.MaxLevel      = 3;
            eq.UpgradeCost   = new[] { 200, 500 };
            eq.SpeedPerLevel = new[] { 1f, 0.8f, 0.6f };
            var dishes = Resources.LoadAll<DishData>("Dishes");
            int n      = dishes != null ? Mathf.Min(dishes.Length, 6) : 0;
            eq.Recipes = new DishData[n];
            for (int i = 0; i < n; i++) eq.Recipes[i] = dishes[i];
            return eq;
        }

        // ── Helpers — Station label ───────────────────────────────────────────

        static void AddStationLabel(GameObject parent)
        {
            var labelGo = new GameObject("StoveLabel");
            labelGo.transform.SetParent(parent.transform, false);
            var canvas  = labelGo.AddComponent<Canvas>();
            canvas.renderMode  = RenderMode.WorldSpace;
            canvas.sortingOrder = 3;
            var rt = labelGo.GetComponent<RectTransform>();
            rt.localPosition = new Vector3(0f, 0.6f, 0f);
            rt.localScale    = Vector3.one * 0.007f;
            rt.sizeDelta     = new Vector2(200, 60);
            var tmp = labelGo.AddComponent<TextMeshPro>();
            tmp.text      = "TAP";
            tmp.fontSize  = 28;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color     = new Color(1f, 0.85f, 0.3f);
        }

        // ── UI factory helpers ────────────────────────────────────────────────

        GameObject MakePanel(Transform parent, Color color)
        {
            var go  = new GameObject("Panel");
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>();
            var img = go.AddComponent<Image>();
            img.color = color;
            return go;
        }

        TextMeshProUGUI MakeText(Transform parent, string text, int size)
        {
            var go  = new GameObject("Text");
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>();
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.text     = text;
            tmp.fontSize = size;
            tmp.color    = Color.white;
            return tmp;
        }

        Button MakeButton(Transform parent, string label, UnityEngine.Events.UnityAction onClick, Color bg)
        {
            var go  = new GameObject("Btn_" + label);
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>();
            var img = go.AddComponent<Image>();
            img.color = bg;
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            var cols = btn.colors;
            cols.highlightedColor = bg * 1.3f;
            cols.pressedColor     = bg * 0.7f;
            btn.colors = cols;
            btn.onClick.AddListener(onClick);
            var txt = MakeText(go.transform, label, 22);
            Anchor(txt, 0, 0, 1, 1, Vector2.zero, Vector2.zero);
            txt.alignment = TextAlignmentOptions.Center;
            return btn;
        }

        void MakeShopRow(string name, string cost, System.Action onClick)
        {
            var row  = new GameObject("Row");
            row.transform.SetParent(_shopList, false);
            var rt   = row.AddComponent<RectTransform>();
            rt.sizeDelta = new Vector2(0, 62);
            var img  = row.AddComponent<Image>();
            img.color = new Color(0.13f, 0.09f, 0.09f, 1f);
            var hlg  = row.AddComponent<HorizontalLayoutGroup>();
            hlg.childAlignment     = TextAnchor.MiddleLeft;
            hlg.padding            = new RectOffset(12, 12, 4, 4);
            hlg.spacing            = 8;
            hlg.childControlHeight = true;
            hlg.childForceExpandHeight = true;

            // Name
            var nGo  = new GameObject("Name"); nGo.transform.SetParent(row.transform, false);
            nGo.AddComponent<RectTransform>();
            var nTxt = nGo.AddComponent<TextMeshProUGUI>();
            nTxt.text    = name;
            nTxt.fontSize = 20;
            var nEle = nGo.AddComponent<LayoutElement>(); nEle.flexibleWidth = 1f;

            // Cost
            var cGo  = new GameObject("Cost"); cGo.transform.SetParent(row.transform, false);
            cGo.AddComponent<RectTransform>();
            var cTxt = cGo.AddComponent<TextMeshProUGUI>();
            cTxt.text       = cost;
            cTxt.fontSize   = 18;
            cTxt.color      = new Color(1f, 0.85f, 0.3f);
            cTxt.alignment  = TextAlignmentOptions.MidlineRight;
            var cEle = cGo.AddComponent<LayoutElement>(); cEle.preferredWidth = 160f;

            if (onClick != null)
            {
                var bGo  = new GameObject("Buy"); bGo.transform.SetParent(row.transform, false);
                bGo.AddComponent<RectTransform>();
                var bImg = bGo.AddComponent<Image>(); bImg.color = new Color(0.45f, 0.15f, 0.04f);
                var btn  = bGo.AddComponent<Button>(); btn.targetGraphic = bImg;
                btn.onClick.AddListener(() => onClick());
                var bTxt = MakeText(bGo.transform, "Buy", 20);
                Anchor(bTxt, 0, 0, 1, 1, Vector2.zero, Vector2.zero);
                bTxt.alignment = TextAlignmentOptions.Center;
                var bEle = bGo.AddComponent<LayoutElement>(); bEle.preferredWidth = 80f; bEle.minWidth = 80f;
            }
        }

        void MakeAssignRow(string zombieName, string action, System.Action onClick)
        {
            var row  = new GameObject("ARow");
            row.transform.SetParent(_assignList, false);
            var rt   = row.AddComponent<RectTransform>();
            rt.sizeDelta = new Vector2(0, 58);
            var img  = row.AddComponent<Image>();
            img.color = new Color(0.13f, 0.09f, 0.09f, 1f);
            var hlg  = row.AddComponent<HorizontalLayoutGroup>();
            hlg.childAlignment     = TextAnchor.MiddleLeft;
            hlg.padding            = new RectOffset(12, 12, 4, 4);
            hlg.spacing            = 8;
            hlg.childControlHeight = true;
            hlg.childForceExpandHeight = true;

            var nGo  = new GameObject("ZName"); nGo.transform.SetParent(row.transform, false);
            nGo.AddComponent<RectTransform>();
            var nTxt = nGo.AddComponent<TextMeshProUGUI>();
            nTxt.text = zombieName; nTxt.fontSize = 20;
            var nEle = nGo.AddComponent<LayoutElement>(); nEle.flexibleWidth = 1f;

            var aGo  = new GameObject("Action"); aGo.transform.SetParent(row.transform, false);
            aGo.AddComponent<RectTransform>();
            var aTxt = aGo.AddComponent<TextMeshProUGUI>();
            aTxt.text = action; aTxt.fontSize = 18;
            aTxt.color = new Color(0.7f, 0.9f, 0.7f);
            var aEle = aGo.AddComponent<LayoutElement>(); aEle.preferredWidth = 180f;

            if (onClick != null)
            {
                var bGo  = new GameObject("Assign"); bGo.transform.SetParent(row.transform, false);
                bGo.AddComponent<RectTransform>();
                var bImg = bGo.AddComponent<Image>(); bImg.color = new Color(0.15f, 0.38f, 0.12f);
                var btn  = bGo.AddComponent<Button>(); btn.targetGraphic = bImg;
                btn.onClick.AddListener(() => onClick());
                var bTxt = MakeText(bGo.transform, "Assign", 19);
                Anchor(bTxt, 0, 0, 1, 1, Vector2.zero, Vector2.zero);
                bTxt.alignment = TextAlignmentOptions.Center;
                var bEle = bGo.AddComponent<LayoutElement>(); bEle.preferredWidth = 90f; bEle.minWidth = 90f;
            }
        }

        void Anchor(object t, float ax, float ay, float bx, float by, Vector2 oMin, Vector2 oMax)
        {
            RectTransform rt = null;
            if (t is RectTransform rr) rt = rr;
            else if (t is Transform tr) rt = tr as RectTransform ?? tr.GetComponent<RectTransform>();
            else if (t is Component c)  rt = c.GetComponent<RectTransform>();
            if (rt == null) return;
            rt.anchorMin = new Vector2(ax, ay);
            rt.anchorMax = new Vector2(bx, by);
            rt.offsetMin = oMin;
            rt.offsetMax = oMax;
        }

        static Color FurnitureColor(string type) => type switch
        {
            "stove"    => new Color(0.70f, 0.28f, 0.08f),
            "pot"      => new Color(0.60f, 0.32f, 0.08f),
            "table"    => new Color(0.38f, 0.22f, 0.08f),
            "chair"    => new Color(0.32f, 0.18f, 0.06f),
            "fridge"   => new Color(0.28f, 0.38f, 0.50f),
            "sink"     => new Color(0.28f, 0.33f, 0.52f),
            "counter"  => new Color(0.43f, 0.28f, 0.12f),
            "decor"    => new Color(0.28f, 0.48f, 0.18f),
            "wall"     => new Color(0.22f, 0.18f, 0.30f),
            "walldecor"=> new Color(0.32f, 0.24f, 0.38f),
            _          => new Color(0.35f, 0.28f, 0.20f)
        };

        static Sprite SolidSprite()
        {
            var tex = new Texture2D(2, 2);
            tex.SetPixels(new[] { Color.white, Color.white, Color.white, Color.white });
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, 2, 2), new Vector2(0.5f, 0.5f), 2f);
        }

        static void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            var go = new GameObject("EventSystem");
            go.AddComponent<EventSystem>();
            go.AddComponent<StandaloneInputModule>();
        }
    }
}
