using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Data;
using ZombieCafe.Zombies;

namespace ZombieCafe.UI
{
    // Displays the zombie encyclopedia. Populate by dragging ZombieData assets into the list.
    public class ZombiePediaUI : MonoBehaviour
    {
        [Header("Refs")]
        public ZombieData[]          AllZombies;   // assign all ZombieData SOs in the Inspector
        public Transform             ListParent;
        public GameObject            EntryPrefab;

        [Header("Detail Panel")]
        public Image                 PortraitImage;
        public TextMeshProUGUI       NameLabel;
        public TextMeshProUGUI       DescriptionLabel;
        public TextMeshProUGUI       StatsLabel;
        public TextMeshProUGUI       RarityLabel;

        ZombieInventory _inventory;

        void Start()
        {
            _inventory = FindFirstObjectByType<ZombieInventory>();
            PopulateList();
        }

        void PopulateList()
        {
            foreach (Transform child in ListParent) Destroy(child.gameObject);

            foreach (var data in AllZombies)
            {
                var go = Instantiate(EntryPrefab, ListParent);
                var entry = go.GetComponent<ZombiePediaEntry>();
                bool owned = _inventory.Zombies.Exists(z => z.Data == data);
                entry.Init(data, owned, () => ShowDetail(data));
            }
        }

        void ShowDetail(ZombieData data)
        {
            if (PortraitImage)    PortraitImage.sprite = data.Portrait;
            if (NameLabel)        NameLabel.text       = data.DisplayName;
            if (DescriptionLabel) DescriptionLabel.text = data.Description;
            if (RarityLabel)      RarityLabel.text     = data.Rarity.ToString();
            if (StatsLabel)
            {
                StatsLabel.text =
                    $"HP: {data.BaseHP}  ATK: {data.BaseAttack}\n" +
                    $"Speed: {data.BaseSpeed:F1}  Cook: x{data.CookSpeedMult:F2}\n" +
                    $"Infect: {data.InfectionChance*100:F0}%";
            }
        }
    }
}
