using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Data;
using ZombieCafe.Economy;
using ZombieCafe.Input;

namespace ZombieCafe.UI
{
    // Main shop panel. Shows tabs: Zombies | Furniture | Boosters | Equipment
    // Each tab displays a scrollable list of purchasable items.
    public class ShopUI : MonoBehaviour
    {
        public enum ShopTab { Zombies, Furniture, Boosters, Equipment }

        [Header("Panels")]
        public GameObject Panel;
        public Button     CloseButton;

        [Header("Tab Buttons")]
        public Button TabZombies;
        public Button TabFurniture;
        public Button TabBoosters;
        public Button TabEquipment;

        [Header("Item List")]
        public Transform  ItemContainer;   // Vertical layout group
        public GameObject ItemRowPrefab;   // Icon + Name + Cost + Buy button

        [Header("Catalog (assign in Inspector)")]
        public ZombieData[]    ZombieCatalog;
        public FurnitureData[] FurnitureCatalog;
        public BoosterData[]   BoosterCatalog;
        public EquipmentData[] EquipmentCatalog;

        [Header("Placement")]
        public PlacementUI PlacementUI;
        public CafeInputHandler InputHandler;

        ShopTab _currentTab = ShopTab.Zombies;

        void Awake()
        {
            CloseButton.onClick.AddListener(Hide);
            TabZombies.onClick.AddListener(() => SwitchTab(ShopTab.Zombies));
            TabFurniture.onClick.AddListener(() => SwitchTab(ShopTab.Furniture));
            TabBoosters.onClick.AddListener(() => SwitchTab(ShopTab.Boosters));
            TabEquipment.onClick.AddListener(() => SwitchTab(ShopTab.Equipment));
        }

        public void Show(ShopTab defaultTab = ShopTab.Zombies)
        {
            Panel.SetActive(true);
            SwitchTab(defaultTab);
        }

        public void Hide() => Panel.SetActive(false);

        void SwitchTab(ShopTab tab)
        {
            _currentTab = tab;
            ClearList();
            switch (tab)
            {
                case ShopTab.Zombies:    PopulateZombies();    break;
                case ShopTab.Furniture:  PopulateFurniture();  break;
                case ShopTab.Boosters:   PopulateBoosters();   break;
                case ShopTab.Equipment:  PopulateEquipment();  break;
            }
        }

        // ── Zombie tab ───────────────────────────────────────────────────────────

        void PopulateZombies()
        {
            foreach (var data in ZombieCatalog)
            {
                var row  = CreateRow(data.DisplayName, $"{data.UnlockCost}{(data.CostInBrains ? " Brains" : " Coins")}");
                var btn  = row.GetComponentInChildren<Button>();
                btn?.onClick.AddListener(() =>
                {
                    ShopManager.Instance.BuyZombie(data);
                });
            }
        }

        // ── Furniture tab ─────────────────────────────────────────────────────────

        void PopulateFurniture()
        {
            foreach (var data in FurnitureCatalog)
            {
                var row = CreateRow(data.DisplayName, $"{data.BuyCost} Coins");
                var btn = row.GetComponentInChildren<Button>();
                btn?.onClick.AddListener(() =>
                {
                    var item = ShopManager.Instance.BuyFurniture(data);
                    if (item == null) return;

                    Hide();
                    PlacementUI.BeginPlacement(data, item);
                });
            }
        }

        // ── Booster tab ───────────────────────────────────────────────────────────

        void PopulateBoosters()
        {
            foreach (var data in BoosterCatalog)
            {
                string label = $"{data.CookSpeedMultiplier}x for {data.DurationSeconds / 60f:0}min — {data.BuyCost} Brains";
                var row = CreateRow(data.DisplayName, label);
                var btn = row.GetComponentInChildren<Button>();
                btn?.onClick.AddListener(() =>
                {
                    ShopManager.Instance.BuyBooster(data);
                });
            }
        }

        // ── Equipment tab ─────────────────────────────────────────────────────────

        void PopulateEquipment()
        {
            foreach (var data in EquipmentCatalog)
            {
                var row = CreateRow(data.DisplayName, $"{data.BuyCost}{(data.CostInBrains ? " Brains" : " Coins")}");
                var btn = row.GetComponentInChildren<Button>();
                btn?.onClick.AddListener(() =>
                {
                    ShopManager.Instance.BuyEquipment(data);
                });
            }
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        void ClearList()
        {
            foreach (Transform child in ItemContainer)
                Destroy(child.gameObject);
        }

        GameObject CreateRow(string itemName, string costText)
        {
            var row      = Instantiate(ItemRowPrefab, ItemContainer);
            var labels   = row.GetComponentsInChildren<TextMeshProUGUI>();
            if (labels.Length >= 1) labels[0].text = itemName;
            if (labels.Length >= 2) labels[1].text = costText;
            return row;
        }
    }
}
