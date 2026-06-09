using UnityEngine;

namespace ZombieCafe.Data
{
    [CreateAssetMenu(fileName = "ZombieData", menuName = "ZombieCafe/Zombie Data")]
    public class ZombieData : ScriptableObject
    {
        [Header("Identity")]
        public string ZombieId;
        public string DisplayName;
        [TextArea] public string Description;
        public Sprite Portrait;
        public RuntimeAnimatorController Animator;

        [Header("Stats (base at level 1)")]
        public int   BaseHP        = 100;
        public int   BaseAttack    = 10;
        public float BaseSpeed     = 2.0f;    // units/sec
        public float CookSpeedMult = 1.0f;    // multiplier on cooking station base time

        [Header("Progression")]
        public int   MaxLevel      = 10;
        public int[] XPPerLevel;              // XP required to reach each level (length == MaxLevel-1)
        public float StatGrowthPct = 0.15f;   // HP and attack grow by this % per level

        [Header("Infection")]
        public ZombieRarity Rarity;
        public float        InfectionChance = 0.25f; // base chance to infect a visiting human

        [Header("Economy")]
        public int  UnlockCost;
        public bool CostInBrains;             // true = brains, false = coins

        public int GetHP(int level)     => Mathf.RoundToInt(BaseHP     * Mathf.Pow(1f + StatGrowthPct, level - 1));
        public int GetAttack(int level) => Mathf.RoundToInt(BaseAttack * Mathf.Pow(1f + StatGrowthPct, level - 1));
        public int GetXPForLevel(int level) => (level >= 2 && XPPerLevel != null && level - 2 < XPPerLevel.Length)
            ? XPPerLevel[level - 2] : int.MaxValue;
    }

    public enum ZombieRarity { Common, Uncommon, Rare, Epic, Legendary }
}
