using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Data;

namespace ZombieCafe.UI
{
    public class ZombiePediaEntry : MonoBehaviour
    {
        public Image              Icon;
        public TextMeshProUGUI    NameLabel;
        public GameObject         LockedOverlay;
        public Button             SelectButton;

        public void Init(ZombieData data, bool owned, Action onSelect)
        {
            if (Icon)         { Icon.sprite = data.Portrait; Icon.color = owned ? Color.white : Color.gray; }
            if (NameLabel)    NameLabel.text = owned ? data.DisplayName : "???";
            if (LockedOverlay) LockedOverlay.SetActive(!owned);
            SelectButton.onClick.RemoveAllListeners();
            if (owned) SelectButton.onClick.AddListener(() => onSelect());
        }
    }
}
