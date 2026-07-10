using UnityEngine;

namespace ZombieCafe.Data
{
    [CreateAssetMenu(fileName = "EquipmentData", menuName = "ZombieCafe/Equipment Data")]
    public class EquipmentData : ScriptableObject
    {
        [Header("Identity")]
        public string EquipmentId;
        public string DisplayName;
        public Sprite Icon;
        public GameObject Prefab;

        [Header("Placement")]
        public Vector2Int Size = Vector2Int.one; // grid cells occupied

        [Header("Economy")]
        public int  BuyCost;
        public bool CostInBrains;

        [Header("Cooking")]
        public DishData[]   Recipes;             // dishes this station can cook
        public int          MaxLevel   = 3;
        public int[]        UpgradeCost;          // coin cost to go from level N to N+1
        public float[]      SpeedPerLevel;        // cook-time multiplier at each level (1.0 = base)
    }
}
