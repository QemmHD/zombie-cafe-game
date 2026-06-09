using System;
using UnityEngine;
using ZombieCafe.Core;

namespace ZombieCafe.Economy
{
    public class CurrencyManager : MonoBehaviour
    {
        public int Coins  { get; private set; }
        public int Brains { get; private set; }

        public event Action<int> OnCoinsChanged;
        public event Action<int> OnBrainsChanged;

        void Start()
        {
            Coins  = SaveSystem.Current.Coins;
            Brains = SaveSystem.Current.Brains;
        }

        public bool SpendCoins(int amount)
        {
            if (Coins < amount) return false;
            Coins -= amount;
            SaveSystem.Current.Coins = Coins;
            OnCoinsChanged?.Invoke(Coins);
            return true;
        }

        public void AddCoins(int amount)
        {
            Coins += amount;
            SaveSystem.Current.Coins = Coins;
            OnCoinsChanged?.Invoke(Coins);
        }

        public bool SpendBrains(int amount)
        {
            if (Brains < amount) return false;
            Brains -= amount;
            SaveSystem.Current.Brains = Brains;
            OnBrainsChanged?.Invoke(Brains);
            return true;
        }

        public void AddBrains(int amount)
        {
            Brains += amount;
            SaveSystem.Current.Brains = Brains;
            OnBrainsChanged?.Invoke(Brains);
        }
    }
}
