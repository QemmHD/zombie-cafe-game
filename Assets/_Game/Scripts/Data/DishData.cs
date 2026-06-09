using UnityEngine;

namespace ZombieCafe.Data
{
    [CreateAssetMenu(fileName = "DishData", menuName = "ZombieCafe/Dish Data")]
    public class DishData : ScriptableObject
    {
        [Header("Identity")]
        public string DishId;
        public string DisplayName;
        [TextArea] public string Description;
        public Sprite DishSprite;

        [Header("Economy")]
        public int  CoinReward    = 20;     // coins earned per serving
        public int  UnlockLevel   = 1;      // cafe level required to unlock
        public int  UnlockCost    = 0;      // 0 = free at that cafe level

        [Header("Cooking")]
        public float BaseCookTime = 30f;    // seconds at cook speed mult 1.0

        [Header("Infection")]
        public float InfectionBonus = 0f;   // added to zombie's infection chance when serving this dish
    }
}
