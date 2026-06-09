using UnityEngine;
using ZombieCafe.Data;
using ZombieCafe.Economy;
using ZombieCafe.Zombies;

namespace ZombieCafe.Economy
{
    public class ShopManager : MonoBehaviour
    {
        CurrencyManager _currency;
        ZombieInventory _inventory;

        void Start()
        {
            _currency  = FindFirstObjectByType<CurrencyManager>();
            _inventory = FindFirstObjectByType<ZombieInventory>();
        }

        public bool BuyZombie(ZombieData data)
        {
            if (data.CostInBrains)
            {
                if (!_currency.SpendBrains(data.UnlockCost)) return false;
            }
            else
            {
                if (!_currency.SpendCoins(data.UnlockCost)) return false;
            }

            return _inventory.AddZombie(data);
        }

        public bool BuyEquipment(EquipmentData data)
        {
            if (data.CostInBrains)
            {
                if (!_currency.SpendBrains(data.BuyCost)) return false;
            }
            else
            {
                if (!_currency.SpendCoins(data.BuyCost)) return false;
            }
            return true; // caller handles placement
        }
    }
}
