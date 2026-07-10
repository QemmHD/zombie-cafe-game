using UnityEngine;

namespace ZombieCafe.Data
{
    [CreateAssetMenu(fileName = "PetData", menuName = "ZombieCafe/Pet Data")]
    public class PetData : ScriptableObject
    {
        [Header("Identity")]
        public string  PetId;
        public string  DisplayName;
        [TextArea] public string Description;
        public Sprite  Portrait;
        public RuntimeAnimatorController Animator;

        [Header("Habitat")]
        public string     HabitatId;     // matches shared_habitat_NNN_X id
        public GameObject HabitatPrefab;
        public Vector2Int HabitatSize = new(2, 2);

        [Header("Combat Stats (base)")]
        public int   BaseHP      = 200;
        public int   BaseAttack  = 25;
        public float BaseSpeed   = 2.5f;

        [Header("Special Ability")]
        public PetAbility Ability;
        [TextArea] public string AbilityDescription;
        public float AbilityCooldown = 10f;

        [Header("Progression")]
        public int MaxLevel = 5;
        public int[] XPPerLevel;

        [Header("Economy")]
        public int  UnlockCost;
        public bool CostInBrains = true;

        public int GetHP(int level)     => Mathf.RoundToInt(BaseHP     * Mathf.Pow(1.2f, level - 1));
        public int GetAttack(int level) => Mathf.RoundToInt(BaseAttack * Mathf.Pow(1.2f, level - 1));
    }

    public enum PetAbility
    {
        None,
        AreaAttack,     // BigBadWolf, Yeti: hits all enemies in radius
        Transform,      // Voltron, RobotPet: transforms into stronger form
        Tornado,        // Tornado: pushes enemies back
        Pounce,         // Wolf/Dog: leaps to farthest enemy
        Shield          // Sphinx: creates damage barrier around allies
    }
}
