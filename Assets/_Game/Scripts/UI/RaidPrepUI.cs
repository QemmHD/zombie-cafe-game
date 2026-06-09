using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Combat;
using ZombieCafe.Core;
using ZombieCafe.Zombies;

namespace ZombieCafe.UI
{
    // Pre-raid screen: pick zombies, confirm to start.
    public class RaidPrepUI : MonoBehaviour
    {
        [Header("Refs")]
        public Transform             ZombieListParent;
        public GameObject            ZombieTogglePrefab;
        public Button                LaunchButton;
        public TextMeshProUGUI       SelectedCountLabel;

        const int MaxRaiders = 5;

        ZombieInventory             _inventory;
        List<ZombieInstance>        _selected = new();

        void OnEnable()
        {
            _inventory = FindFirstObjectByType<ZombieInventory>();
            PopulateList();
        }

        void PopulateList()
        {
            foreach (Transform t in ZombieListParent) Destroy(t.gameObject);
            _selected.Clear();

            foreach (var z in _inventory.GetAvailableForRaid())
            {
                var go = Instantiate(ZombieTogglePrefab, ZombieListParent);
                var toggle = go.GetComponent<Toggle>();
                var label  = go.GetComponentInChildren<TextMeshProUGUI>();
                if (label) label.text = $"{z.Data.DisplayName} Lv{z.Level}";
                var capture = z;
                toggle.onValueChanged.AddListener(on =>
                {
                    if (on && _selected.Count < MaxRaiders) _selected.Add(capture);
                    else _selected.Remove(capture);
                    UpdateSelectionLabel();
                });
            }

            LaunchButton.onClick.RemoveAllListeners();
            LaunchButton.onClick.AddListener(LaunchRaid);
            UpdateSelectionLabel();
        }

        void UpdateSelectionLabel()
        {
            if (SelectedCountLabel) SelectedCountLabel.text = $"{_selected.Count}/{MaxRaiders} selected";
            LaunchButton.interactable = _selected.Count > 0;
        }

        void LaunchRaid()
        {
            // Build a placeholder target cafe (in a real build this comes from server/neighbour list)
            var target = new CafeData { OwnerName = "Neighbour", CoinLoot = 200 };
            GameManager.Instance.EnterRaidMode(target);
            gameObject.SetActive(false);
        }
    }
}
