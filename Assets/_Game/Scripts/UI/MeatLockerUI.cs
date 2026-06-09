using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Cafe;
using ZombieCafe.Zombies;

namespace ZombieCafe.UI
{
    // Panel that shows zombies stored in the Meat Locker (overflow storage).
    // Each row: zombie name/level + Retrieve button.
    public class MeatLockerUI : MonoBehaviour
    {
        [Header("References")]
        public GameObject Panel;
        public Transform  RowContainer;    // Vertical layout group
        public GameObject RowPrefab;       // TextMeshProUGUI + Button
        public TextMeshProUGUI CapacityLabel; // "3 / 10"
        public Button     CloseButton;

        void Awake()
        {
            CloseButton?.onClick.AddListener(Hide);
        }

        public void Show()
        {
            Panel.SetActive(true);
            Refresh();
        }

        public void Hide() => Panel.SetActive(false);

        void Refresh()
        {
            // Clear old rows
            foreach (Transform child in RowContainer)
                Destroy(child.gameObject);

            var locker = MeatLocker.Instance;
            if (locker == null) return;

            var stored = locker.Stored;
            if (CapacityLabel != null)
                CapacityLabel.text = $"{stored.Count} / {locker.Capacity}";

            for (int i = 0; i < stored.Count; i++)
            {
                var zombie = stored[i];
                var row    = Instantiate(RowPrefab, RowContainer);
                var label  = row.GetComponentInChildren<TextMeshProUGUI>();
                var btn    = row.GetComponentInChildren<Button>();

                if (label != null)
                    label.text = $"{zombie.Data?.DisplayName ?? "Zombie"} Lv.{zombie.Level}";

                int capturedIndex = i;
                btn?.onClick.AddListener(() =>
                {
                    locker.Retrieve(capturedIndex);
                    Refresh();
                });
            }
        }
    }
}
