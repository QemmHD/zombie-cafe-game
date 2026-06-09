using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Economy;

namespace ZombieCafe.Cafe
{
    public class CafeManager : MonoBehaviour
    {
        public int Level { get; private set; } = 1;

        [Header("Upgrade")]
        public int[] LevelUpCost;   // coin cost indexed by current level (0 = level 1->2)

        List<CookingStation> _stations = new();
        CurrencyManager      _currency;

        void Start()
        {
            Level     = SaveSystem.Current.CafeLevel;
            _currency = FindFirstObjectByType<CurrencyManager>();

            foreach (var s in FindObjectsByType<CookingStation>(FindObjectsSortMode.None))
                _stations.Add(s);
        }

        public bool TryUpgradeCafe()
        {
            if (Level >= LevelUpCost.Length + 1) return false;
            int cost = LevelUpCost[Level - 1];
            if (!_currency.SpendCoins(cost)) return false;
            Level++;
            SaveSystem.Current.CafeLevel = Level;
            return true;
        }

        public List<CookingStation> GetReadyStations() =>
            _stations.FindAll(s => s.State == StationState.Ready);

        public List<CookingStation> GetEmptyStations() =>
            _stations.FindAll(s => s.State == StationState.Empty);
    }
}
