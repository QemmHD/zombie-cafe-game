using UnityEngine;
using ZombieCafe.Data;

namespace ZombieCafe.Cafe
{
    // Placed on the grid; applies its buff to all zombies in the cafe.
    // TombstoneManager (static) aggregates all active tombstones.
    public class Tombstone : MonoBehaviour
    {
        public TombstoneData Data;

        void OnEnable()  => TombstoneManager.Register(this);
        void OnDisable() => TombstoneManager.Unregister(this);
    }

    // Aggregate buff values from all placed tombstones.
    public static class TombstoneManager
    {
        static readonly System.Collections.Generic.List<Tombstone> _active = new();

        public static void Register(Tombstone t)   { if (!_active.Contains(t)) _active.Add(t); }
        public static void Unregister(Tombstone t) { _active.Remove(t); }

        public static float GetTotalBuff(TombstoneBuff type)
        {
            float total = 0f;
            foreach (var t in _active)
                if (t.Data.BuffType == type) total += t.Data.BuffValue;
            return total;
        }

        // Applies strength + health buffs to a zombie's final stats.
        public static int ApplyHP(int baseHP)         => Mathf.RoundToInt(baseHP     * (1f + GetTotalBuff(TombstoneBuff.Health)));
        public static int ApplyAttack(int baseAttack) => Mathf.RoundToInt(baseAttack * (1f + GetTotalBuff(TombstoneBuff.Strength)));
    }
}
