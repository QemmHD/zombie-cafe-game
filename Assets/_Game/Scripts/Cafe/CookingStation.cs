using System;
using System.Collections;
using UnityEngine;
using ZombieCafe.Data;
using ZombieCafe.Economy;
using ZombieCafe.Zombies;

namespace ZombieCafe.Cafe
{
    public enum StationState { Empty, Cooking, Ready, Idle }

    public class CookingStation : MonoBehaviour
    {
        [Header("Config")]
        public EquipmentData Data;
        public int           Level = 1;

        public StationState State    { get; private set; } = StationState.Empty;
        public DishData     CurrentDish  { get; private set; }
        public ZombieInstance AssignedZombie { get; private set; }
        public float        Progress  { get; private set; }  // 0..1
        public float        TimeLeft  { get; private set; }

        public event Action<CookingStation> OnDishReady;

        CurrencyManager _currency;

        void Start()
        {
            _currency = FindFirstObjectByType<CurrencyManager>();
        }

        public bool AssignZombie(ZombieInstance zombie, DishData dish)
        {
            if (State != StationState.Empty) return false;
            if (Array.IndexOf(Data.Recipes, dish) < 0) return false;

            AssignedZombie = zombie;
            CurrentDish    = dish;
            zombie.Assignment = "kitchen";

            StartCoroutine(CookRoutine());
            return true;
        }

        IEnumerator CookRoutine()
        {
            State = StationState.Cooking;

            float speedMult = Level <= Data.SpeedPerLevel.Length ? Data.SpeedPerLevel[Level - 1] : 1f;
            float cookTime  = CurrentDish.BaseCookTime * speedMult * (1f / AssignedZombie.Data.CookSpeedMult);
            TimeLeft = cookTime;
            float elapsed = 0f;

            while (elapsed < cookTime)
            {
                elapsed  += Time.deltaTime;
                TimeLeft  = cookTime - elapsed;
                Progress  = elapsed / cookTime;
                yield return null;
            }

            State    = StationState.Ready;
            Progress = 1f;
            TimeLeft = 0f;
            OnDishReady?.Invoke(this);
        }

        public void CollectDish()
        {
            if (State != StationState.Ready) return;

            _currency.AddCoins(CurrentDish.CoinReward);

            if (AssignedZombie != null)
                AssignedZombie.Assignment = "idle";

            AssignedZombie = null;
            CurrentDish    = null;
            State          = StationState.Empty;
            Progress       = 0f;
        }

        public void Upgrade()
        {
            if (Level >= Data.MaxLevel) return;
            int cost = Data.UpgradeCost[Level - 1];
            if (!_currency.SpendCoins(cost)) return;
            Level++;
        }
    }
}
