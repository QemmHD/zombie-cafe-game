using System;
using System.IO;
using UnityEngine;

namespace ZombieCafe.Core
{
    [Serializable]
    public class SaveData
    {
        public int    SaveVersion  = 2;
        public int    Coins        = 500;
        public int    Brains       = 10;
        public int    CafeLevel    = 1;
        public int    PlayerXP     = 0;
        public int    PlayerLevel  = 1;
        public string PlayerName   = "Zombie Chef";
        public int    GridWidth    = 7;
        public int    GridHeight   = 8;
        public long   LastSaveUtc  = 0;

        public ZombieSaveEntry[]     Zombies      = Array.Empty<ZombieSaveEntry>();
        public FurnitureSaveEntry[]  Furniture    = Array.Empty<FurnitureSaveEntry>();
        public TombstoneSaveEntry[]  Tombstones   = Array.Empty<TombstoneSaveEntry>();
        public PetSaveEntry[]        Pets         = Array.Empty<PetSaveEntry>();
        public MeatLockerEntry[]     MeatLocker   = Array.Empty<MeatLockerEntry>();
    }

    [Serializable]
    public class ZombieSaveEntry
    {
        public string ZombieId;
        public int    Level;
        public int    XP;
        public string Assignment; // "kitchen", "idle", "raiding", "patrol", "meatlocker"
    }

    [Serializable]
    public class FurnitureSaveEntry
    {
        public string FurnitureId;
        public string FurnitureType; // "stove", "table", "chair", "fridge", "sink", "counter", "decor", "wall", "wallDecor"
        public int    GridX;
        public int    GridY;
        public int    Level;
    }

    [Serializable]
    public class TombstoneSaveEntry
    {
        public string TombstoneId;
        public int    GridX;
        public int    GridY;
    }

    [Serializable]
    public class PetSaveEntry
    {
        public string PetId;
        public int    Level;
        public int    HabitatGridX;
        public int    HabitatGridY;
    }

    [Serializable]
    public class MeatLockerEntry
    {
        public string ZombieId;
        public int    Level;
        public int    XP;
    }

    public static class SaveSystem
    {
        static readonly string SavePath = Path.Combine(Application.persistentDataPath, "save.json");

        public static SaveData Current { get; private set; } = new();

        public static void Save()
        {
            Current.LastSaveUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            File.WriteAllText(SavePath, JsonUtility.ToJson(Current, prettyPrint: true));
        }

        public static void Load()
        {
            if (!File.Exists(SavePath)) { Current = new SaveData(); return; }
            try
            {
                Current = JsonUtility.FromJson<SaveData>(File.ReadAllText(SavePath));
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Load failed: {e.Message} — using fresh save.");
                Current = new SaveData();
            }
        }

        public static void DeleteSave()
        {
            if (File.Exists(SavePath)) File.Delete(SavePath);
            Current = new SaveData();
        }
    }
}
