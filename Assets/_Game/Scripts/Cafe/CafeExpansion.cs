using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Economy;

namespace ZombieCafe.Cafe
{
    // Handles buying expansion tiles to grow the cafe grid.
    // Expansion sizes mirror the original: 7x8 -> 8x9 -> ... -> 16x17
    public class CafeExpansion : MonoBehaviour
    {
        [System.Serializable]
        public struct ExpansionTier
        {
            public int   Width;
            public int   Height;
            public int   CoinCost;
            public bool  CostInBrains;
            public int   BrainCost;
            public int   CafeLevelRequired;
        }

        public ExpansionTier[] Tiers = new ExpansionTier[]
        {
            new() { Width=8,  Height=9,  CoinCost=5000,   CafeLevelRequired=2  },
            new() { Width=9,  Height=10, CoinCost=15000,  CafeLevelRequired=4  },
            new() { Width=10, Height=11, CoinCost=40000,  CafeLevelRequired=6  },
            new() { Width=11, Height=12, CoinCost=100000, CafeLevelRequired=8  },
            new() { Width=12, Height=13, CoinCost=0, CostInBrains=true, BrainCost=5,  CafeLevelRequired=10 },
            new() { Width=13, Height=14, CoinCost=0, CostInBrains=true, BrainCost=10, CafeLevelRequired=12 },
            new() { Width=14, Height=15, CoinCost=0, CostInBrains=true, BrainCost=15, CafeLevelRequired=15 },
            new() { Width=15, Height=16, CoinCost=0, CostInBrains=true, BrainCost=20, CafeLevelRequired=18 },
            new() { Width=16, Height=17, CoinCost=0, CostInBrains=true, BrainCost=30, CafeLevelRequired=20 },
        };

        CurrencyManager _currency;
        CafeManager     _cafe;

        void Start()
        {
            _currency = FindFirstObjectByType<CurrencyManager>();
            _cafe     = FindFirstObjectByType<CafeManager>();
        }

        public ExpansionTier? NextTier()
        {
            int w = SaveSystem.Current.GridWidth;
            int h = SaveSystem.Current.GridHeight;
            foreach (var t in Tiers)
                if (t.Width > w || t.Height > h) return t;
            return null;
        }

        public bool TryExpand()
        {
            var next = NextTier();
            if (next == null) return false;
            var t = next.Value;

            if (t.CafeLevelRequired > _cafe.Level) return false;

            if (t.CostInBrains)
            { if (!_currency.SpendBrains(t.BrainCost)) return false; }
            else
            { if (!_currency.SpendCoins(t.CoinCost))  return false; }

            GridManager.Instance.Expand(t.Width, t.Height);
            EventBus.Publish(new NotificationEvent { Message = $"Cafe expanded to {t.Width}x{t.Height}!", Duration = 3f });
            return true;
        }
    }
}
