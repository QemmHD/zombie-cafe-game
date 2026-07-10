using UnityEngine;

namespace ZombieCafe.Data
{
    public enum FurnitureType
    {
        Stove, Table, Chair, Fridge, Sink, Counter,
        Pot, Decor, Wall, WallDecor, Floor
    }

    [CreateAssetMenu(fileName = "FurnitureData", menuName = "ZombieCafe/Furniture Data")]
    public class FurnitureData : ScriptableObject
    {
        [Header("Identity")]
        public string        FurnitureId;
        public string        DisplayName;
        public FurnitureType Type;
        public Sprite        Icon;
        public GameObject    Prefab;

        [Header("Placement")]
        public Vector2Int Size = Vector2Int.one;

        [Header("Economy")]
        public int  BuyCost;
        public bool CostInBrains;
        public int  SellValue;     // coins refunded on removal (usually ~50% of buy cost)
        public int  CafeLevelRequired = 1;

        [Header("Stove Only")]
        public float CookSpeedBonus = 0f;  // added to all stations when this stove is placed

        [Header("Decor")]
        public int HappinessBonus = 0;     // future: customer happiness / tip boost
    }
}
