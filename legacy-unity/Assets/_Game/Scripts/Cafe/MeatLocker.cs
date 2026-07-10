using System;
using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Data;
using ZombieCafe.Zombies;

namespace ZombieCafe.Cafe
{
    // Stores zombies that don't fit in the active roster.
    // Cap increases with cafe level.
    public class MeatLocker : MonoBehaviour
    {
        public static MeatLocker Instance { get; private set; }

        public List<ZombieInstance> Stored { get; } = new();

        public int Capacity => 10 + (SaveSystem.Current.CafeLevel - 1) * 5;
        public bool IsFull  => Stored.Count >= Capacity;

        public event Action OnChanged;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start()
        {
            foreach (var e in SaveSystem.Current.MeatLocker)
            {
                var data = Resources.Load<ZombieData>($"Zombies/{e.ZombieId}");
                if (data == null) continue;
                Stored.Add(new ZombieInstance { Data = data, Level = e.Level, XP = e.XP, Assignment = "meatlocker" });
            }
        }

        public bool Store(ZombieInstance zombie)
        {
            if (IsFull) return false;
            zombie.Assignment = "meatlocker";
            Stored.Add(zombie);
            Persist();
            OnChanged?.Invoke();
            return true;
        }

        public ZombieInstance Retrieve(int index)
        {
            if (index < 0 || index >= Stored.Count) return null;
            var z = Stored[index];
            Stored.RemoveAt(index);
            z.Assignment = "idle";
            Persist();
            OnChanged?.Invoke();
            return z;
        }

        void Persist()
        {
            var entries = new MeatLockerEntry[Stored.Count];
            for (int i = 0; i < Stored.Count; i++)
                entries[i] = new MeatLockerEntry { ZombieId = Stored[i].Data.ZombieId, Level = Stored[i].Level, XP = Stored[i].XP };
            SaveSystem.Current.MeatLocker = entries;
        }
    }
}
