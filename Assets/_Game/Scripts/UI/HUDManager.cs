using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Core;
using ZombieCafe.Economy;

namespace ZombieCafe.UI
{
    public class HUDManager : MonoBehaviour
    {
        [Header("Currency")]
        public TextMeshProUGUI CoinsLabel;
        public TextMeshProUGUI BrainsLabel;

        [Header("Panels")]
        public GameObject CafePanel;
        public GameObject RaidPanel;
        public GameObject StorePanel;
        public GameObject ZombiePediaPanel;

        [Header("Buttons")]
        public Button StoreButton;
        public Button ZombiePediaButton;
        public Button RaidButton;

        CurrencyManager _currency;

        void Start()
        {
            _currency = FindFirstObjectByType<CurrencyManager>();
            _currency.OnCoinsChanged  += UpdateCoins;
            _currency.OnBrainsChanged += UpdateBrains;

            UpdateCoins(_currency.Coins);
            UpdateBrains(_currency.Brains);

            StoreButton.onClick.AddListener(OpenStore);
            ZombiePediaButton.onClick.AddListener(OpenZombiePedia);
            RaidButton.onClick.AddListener(OpenRaidPrep);

            ShowPanel(CafePanel);
        }

        void OnDestroy()
        {
            if (_currency == null) return;
            _currency.OnCoinsChanged  -= UpdateCoins;
            _currency.OnBrainsChanged -= UpdateBrains;
        }

        void UpdateCoins(int val)  => CoinsLabel.text  = val.ToString("N0");
        void UpdateBrains(int val) => BrainsLabel.text = val.ToString("N0");

        void ShowPanel(GameObject target)
        {
            foreach (var p in new[] { CafePanel, RaidPanel, StorePanel, ZombiePediaPanel })
                if (p != null) p.SetActive(p == target);
        }

        void OpenStore()       => ShowPanel(StorePanel);
        void OpenZombiePedia() => ShowPanel(ZombiePediaPanel);
        void OpenRaidPrep()    => ShowPanel(RaidPanel);
        public void OpenCafe() => ShowPanel(CafePanel);
    }
}
