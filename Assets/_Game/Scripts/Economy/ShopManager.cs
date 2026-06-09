using UnityEngine;
using ZombieCafe.Cafe;
using ZombieCafe.Core;
using ZombieCafe.Data;
using ZombieCafe.Zombies;

namespace ZombieCafe.Economy
{
    public class ShopManager : MonoBehaviour
    {
        public static ShopManager Instance { get; private set; }

        CurrencyManager _currency;
        ZombieInventory _inventory;
        MeatLocker      _locker;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start()
        {
            _currency  = FindFirstObjectByType<CurrencyManager>();
            _inventory = FindFirstObjectByType<ZombieInventory>();
            _locker    = MeatLocker.Instance;
        }

        // ── Zombie ───────────────────────────────────────────────────────────────

        public bool BuyZombie(ZombieData data)
        {
            bool spent = data.CostInBrains
                ? _currency.SpendBrains(data.UnlockCost)
                : _currency.SpendCoins(data.UnlockCost);
            if (!spent) return false;

            if (_inventory.AddZombie(data)) return true;

            // Roster full — try Meat Locker
            if (_locker != null && _locker.Store(new ZombieInstance { Data = data }))
            {
                EventBus.Publish(new NotificationEvent
                {
                    Message  = $"{data.DisplayName} sent to Meat Locker (roster full).",
                    Duration = 3f
                });
                return true;
            }

            // Refund if nowhere to put it
            if (data.CostInBrains) _currency.AddBrains(data.UnlockCost);
            else                    _currency.AddCoins(data.UnlockCost);
            return false;
        }

        // ── Equipment ────────────────────────────────────────────────────────────

        public bool BuyEquipment(EquipmentData data)
        {
            bool spent = data.CostInBrains
                ? _currency.SpendBrains(data.BuyCost)
                : _currency.SpendCoins(data.BuyCost);
            return spent; // caller handles placement
        }

        // ── Furniture ────────────────────────────────────────────────────────────

        // Returns a PlaceableItem GO ready to be placed; null if purchase failed.
        public PlaceableItem BuyFurniture(FurnitureData data)
        {
            if (data.CafeLevelRequired > Core.SaveSystem.Current.CafeLevel)
            {
                EventBus.Publish(new NotificationEvent
                {
                    Message  = $"Requires Cafe Lv.{data.CafeLevelRequired}.",
                    Duration = 2f
                });
                return null;
            }

            if (!_currency.SpendCoins(data.BuyCost))
            {
                EventBus.Publish(new NotificationEvent { Message = "Not enough coins.", Duration = 2f });
                return null;
            }

            var go   = new UnityEngine.GameObject(data.FurnitureId);
            var item = go.AddComponent<PlaceableItem>();
            item.ItemId   = data.FurnitureId;
            item.ItemType = data.FurnitureType.ToString().ToLower();
            item.Size     = data.Size;
            return item;
        }

        // ── Boosters ─────────────────────────────────────────────────────────────

        public bool BuyBooster(BoosterData data)
        {
            var booster = BoosterManager.Instance;
            if (booster == null) return false;
            return booster.Activate(data, _currency);
        }
    }
}
