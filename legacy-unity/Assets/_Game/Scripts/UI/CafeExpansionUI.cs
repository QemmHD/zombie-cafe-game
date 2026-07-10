using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Cafe;
using ZombieCafe.Economy;

namespace ZombieCafe.UI
{
    // Shows the next expansion tier info and a Buy button.
    // Attach to a panel that sits at the edge of the current cafe boundary.
    public class CafeExpansionUI : MonoBehaviour
    {
        [Header("References")]
        public CafeExpansion     Expansion;
        public TextMeshProUGUI   SizeLabel;       // "Next: 10x10"
        public TextMeshProUGUI   CostLabel;       // "500 Coins + 10 Brains"
        public TextMeshProUGUI   LevelReqLabel;   // "Requires Cafe Lv.3"
        public Button            BuyButton;
        public GameObject        Panel;

        void Awake() => BuyButton.onClick.AddListener(OnBuy);

        void OnEnable()  => Refresh();

        public void Show() { Panel.SetActive(true); Refresh(); }
        public void Hide() => Panel.SetActive(false);

        void Refresh()
        {
            if (Expansion == null) return;

            var next = Expansion.NextTier();
            if (next == null)
            {
                SizeLabel.text     = "Max size reached";
                CostLabel.text     = "";
                LevelReqLabel.text = "";
                BuyButton.interactable = false;
                return;
            }

            SizeLabel.text     = $"Next: {next.Value.Width}x{next.Value.Height}";
            CostLabel.text     = $"{next.Value.CoinCost} Coins + {next.Value.BrainCost} Brains";
            LevelReqLabel.text = next.Value.CafeLevelRequired > 1
                ? $"Requires Cafe Lv.{next.Value.CafeLevelRequired}"
                : "";

                    // CafeExpansion.TryExpand() handles currency internally
            bool canAfford = true;

            BuyButton.interactable = canAfford;
        }

            void OnBuy()
        {
            if (Expansion == null) return;
            if (Expansion.TryExpand())
            {
                Refresh();
                NotificationManager.Show("Cafe expanded!");
            }
            else
            {
                NotificationManager.Show("Not enough resources.", 2f);
            }
        }
    }
}
