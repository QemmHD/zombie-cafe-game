using UnityEngine;

namespace ZombieCafe.Data
{
    public enum TombstoneBuff { Strength, Health, Revive, Decorative, GrimReaper, SuperServer, Pet }

    [CreateAssetMenu(fileName = "TombstoneData", menuName = "ZombieCafe/Tombstone Data")]
    public class TombstoneData : ScriptableObject
    {
        [Header("Identity")]
        public string        TombstoneId;
        public string        DisplayName;
        public Sprite        Icon;
        public GameObject    Prefab;

        [Header("Buff")]
        public TombstoneBuff BuffType;
        public float         BuffValue;   // e.g. 0.10 = +10% to the stat
        [TextArea] public string BuffDescription;

        [Header("Economy")]
        public int  BuyCost;
        public bool CostInBrains;
        public int  CafeLevelRequired = 1;
    }
}
