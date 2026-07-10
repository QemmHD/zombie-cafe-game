using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Cafe;

namespace ZombieCafe.UI
{
    // Floating UI above a CookingStation showing progress + collect button.
    public class StationUI : MonoBehaviour
    {
        [Header("Refs")]
        public CookingStation Station;

        [Header("Widgets")]
        public GameObject  CookingGroup;
        public Slider      ProgressBar;
        public TextMeshProUGUI TimeLabel;
        public Button      CollectButton;
        public GameObject  ReadyIndicator;

        void Start()
        {
            CollectButton.onClick.AddListener(() => Station.CollectDish());
            Station.OnDishReady += _ => RefreshVisuals();
        }

        void Update() => RefreshVisuals();

        void RefreshVisuals()
        {
            bool cooking = Station.State == StationState.Cooking;
            bool ready   = Station.State == StationState.Ready;

            CookingGroup.SetActive(cooking);
            ReadyIndicator.SetActive(ready);
            CollectButton.gameObject.SetActive(ready);

            if (cooking)
            {
                ProgressBar.value = Station.Progress;
                int secs = Mathf.CeilToInt(Station.TimeLeft);
                TimeLabel.text = secs >= 60 ? $"{secs/60}m {secs%60}s" : $"{secs}s";
            }
        }
    }
}
