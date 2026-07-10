using UnityEngine;

namespace ZombieCafe.Cafe
{
    // Attached to every GameObject placed on the grid.
    public class PlaceableItem : MonoBehaviour
    {
        public Vector2Int GridPosition;
        public Vector2Int Size = Vector2Int.one;
        public string     ItemId;
        public string     ItemType; // "stove","table","chair","fridge","sink","counter","decor","wall","tombstone","habitat"
    }
}
