using System;
using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Data;

namespace ZombieCafe.Zombies
{
    public class ZombieInstance
    {
        public ZombieData Data;
        public int        Level   = 1;
        public int        XP      = 0;
        public string     Assignment = "idle"; // "kitchen", "idle", "raiding", "meatlocker"

        public int CurrentHP  => Data.GetHP(Level);
        public int Attack     => Data.GetAttack(Level);
        public float Speed    => Data.BaseSpeed;

        public bool TryLevelUp()
        {
            int xpNeeded = Data.GetXPForLevel(Level + 1);
            if (Level >= Data.MaxLevel || XP < xpNeeded) return false;
            XP -= xpNeeded;
            Level++;
            return true;
        }
    }

    public class ZombieInventory : MonoBehaviour
    {
        public List<ZombieInstance> Zombies { get; } = new();

        public event Action OnInventoryChanged;

        public int MaxZombies => 5 + (SaveSystem.Current.CafeLevel - 1) * 2;

        void Start()
        {
            // Restore from save (ZombieData assets must be loaded from Resources)
            foreach (var entry in SaveSystem.Current.Zombies)
            {
                var data = Resources.Load<ZombieData>($"Zombies/{entry.ZombieId}");
                if (data == null) continue;
                Zombies.Add(new ZombieInstance
                {
                    Data       = data,
                    Level      = entry.Level,
                    XP         = entry.XP,
                    Assignment = entry.Assignment
                });
            }
        }

        public bool AddZombie(ZombieData data)
        {
            if (Zombies.Count >= MaxZombies) return false;
            Zombies.Add(new ZombieInstance { Data = data });
            PersistZombies();
            OnInventoryChanged?.Invoke();
            return true;
        }

        public void AddXP(ZombieInstance zombie, int amount)
        {
            zombie.XP += amount;
            while (zombie.TryLevelUp()) {}
            PersistZombies();
            OnInventoryChanged?.Invoke();
        }

        public List<ZombieInstance> GetAvailableForRaid() =>
            Zombies.FindAll(z => z.Assignment == "idle");

        void PersistZombies()
        {
            var entries = new ZombieSaveEntry[Zombies.Count];
            for (int i = 0; i < Zombies.Count; i++)
            {
                entries[i] = new ZombieSaveEntry
                {
                    ZombieId   = Zombies[i].Data.ZombieId,
                    Level      = Zombies[i].Level,
                    XP         = Zombies[i].XP,
                    Assignment = Zombies[i].Assignment
                };
            }
            SaveSystem.Current.Zombies = entries;
        }
    }
}
