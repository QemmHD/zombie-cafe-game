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
        // Application.persistentDataPath is the only writable, persistent location on iOS
        // (maps to the app container's Documents dir, which survives relaunches and app updates
        // and is included in iCloud/iTunes device backups).
        static readonly string SavePath    = Path.Combine(Application.persistentDataPath, "save.json");
        static readonly string TempPath    = SavePath + ".tmp";
        static readonly string BackupPath  = SavePath + ".bak";

        public static SaveData Current { get; private set; } = new();

        public static void Save()
        {
            Current.LastSaveUtc = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            string json = JsonUtility.ToJson(Current, prettyPrint: true);

            try
            {
                // Atomic write: serialize to a temp file first, then swap it into place.
                // iOS can kill a suspended app mid-write, so writing directly to save.json
                // risks leaving a truncated/corrupt file. Replace keeps the previous good
                // copy as a .bak we can fall back to on load.
                File.WriteAllText(TempPath, json);

                if (File.Exists(SavePath))
                    File.Replace(TempPath, SavePath, BackupPath);
                else
                    File.Move(TempPath, SavePath);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Save failed: {e.Message}");
            }
        }

        public static void Load()
        {
            if (TryLoad(SavePath)) return;

            // Primary missing or corrupt — recover from the last known-good backup.
            if (File.Exists(BackupPath) && TryLoad(BackupPath))
            {
                Debug.LogWarning("[SaveSystem] Primary save unreadable — recovered from backup.");
                return;
            }

            Current = new SaveData();
        }

        static bool TryLoad(string path)
        {
            if (!File.Exists(path)) return false;
            try
            {
                var data = JsonUtility.FromJson<SaveData>(File.ReadAllText(path));
                if (data == null) return false;
                Current = data;
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Load failed for {Path.GetFileName(path)}: {e.Message}");
                return false;
            }
        }

        public static void DeleteSave()
        {
            if (File.Exists(SavePath))   File.Delete(SavePath);
            if (File.Exists(BackupPath)) File.Delete(BackupPath);
            if (File.Exists(TempPath))   File.Delete(TempPath);
            Current = new SaveData();
        }
    }
}
