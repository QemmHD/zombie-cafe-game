using System;
using UnityEngine;

namespace ZombieCafe.Core
{
    public class PlayerProfile : MonoBehaviour
    {
        public static PlayerProfile Instance { get; private set; }

        public string PlayerName  { get; private set; } = "Zombie Chef";
        public int    PlayerLevel { get; private set; } = 1;
        public int    PlayerXP    { get; private set; } = 0;

        // XP required to reach level N+1 (index 0 = level 1 -> 2)
        static readonly int[] XPTable =
        {
            100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 7800,
            10000, 13000, 16500, 20500, 25000, 30000, 36000, 43000, 51000, 60000
        };

        public int XPToNextLevel => PlayerLevel - 1 < XPTable.Length ? XPTable[PlayerLevel - 1] : int.MaxValue;
        public float XPProgress  => PlayerLevel - 1 < XPTable.Length ? (float)PlayerXP / XPTable[PlayerLevel - 1] : 1f;
        public int MaxLevel      => XPTable.Length + 1;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start()
        {
            PlayerXP    = SaveSystem.Current.PlayerXP;
            PlayerLevel = SaveSystem.Current.PlayerLevel;
            PlayerName  = SaveSystem.Current.PlayerName;
        }

        public void AddXP(int amount)
        {
            PlayerXP += amount;
            while (PlayerLevel < MaxLevel && PlayerXP >= XPToNextLevel)
            {
                PlayerXP -= XPToNextLevel;
                PlayerLevel++;
                SaveSystem.Current.PlayerLevel = PlayerLevel;
                EventBus.Publish(new PlayerLevelUpEvent { NewLevel = PlayerLevel });
                EventBus.Publish(new NotificationEvent { Message = $"Level Up! Now level {PlayerLevel}", Duration = 3f });
            }
            SaveSystem.Current.PlayerXP = PlayerXP;
        }

        public void SetName(string name)
        {
            PlayerName = string.IsNullOrWhiteSpace(name) ? "Zombie Chef" : name.Trim();
            SaveSystem.Current.PlayerName = PlayerName;
        }
    }
}
