using System;
using System.IO;
using UnityEngine;

namespace ZombieCafe.Core
{
    [Serializable]
    public class SaveData
    {
        public int    Coins       = 500;
        public int    Brains      = 10;
        public int    CafeLevel   = 1;
        public int    PlayerXP    = 0;
        public long   LastSaveUtc = 0;

        public ZombieSaveEntry[]   Zombies    = Array.Empty<ZombieSaveEntry>();
        public EquipmentSaveEntry[] Equipment  = Array.Empty<EquipmentSaveEntry>();
    }

    [Serializable]
    public class ZombieSaveEntry
    {
        public string ZombieId;
        public int    Level;
        public int    XP;
        public string Assignment; // "kitchen", "idle", "raiding"
    }

    [Serializable]
    public class EquipmentSaveEntry
    {
        public string EquipmentId;
        public int    Slot;
        public int    Level;
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
