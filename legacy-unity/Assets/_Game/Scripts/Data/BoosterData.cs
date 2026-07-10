using UnityEngine;

namespace ZombieCafe.Data
{
    public enum BoosterTier { Turbo, Super, Hyper }

    [CreateAssetMenu(fileName = "BoosterData", menuName = "ZombieCafe/Booster Data")]
    public class BoosterData : ScriptableObject
    {
        public string     BoosterId;
        public string     DisplayName;
        public BoosterTier Tier;
        public Sprite     Icon;

        // Turbo = 2x, Super = 3x, Hyper = 4x cook speed
        public float CookSpeedMultiplier = 2f;

        // Duration this booster affects all stations once activated
        public float DurationSeconds = 300f; // 5 minutes

        public int BuyCost;   // always costs brains
    }
}
