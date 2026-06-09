using UnityEngine;
using ZombieCafe.Cafe;
using ZombieCafe.Data;

namespace ZombieCafe.Core
{
    // Represents an in-progress furniture placement operation.
    // Created by PlacementUI; consumed by CafeInputHandler to route taps.
    public class PlacementSession
    {
        public PlaceableItem Item      { get; }
        public FurnitureData Furniture { get; }
        public bool          IsActive  { get; private set; } = true;

        public PlacementSession(PlaceableItem item, FurnitureData furniture)
        {
            Item      = item;
            Furniture = furniture;
        }

        // Called by CafeInputHandler when the player taps a valid grid cell.
        public bool TryConfirm(int gridX, int gridY)
        {
            if (!IsActive) return false;

            var cell = new Vector2Int(gridX, gridY);
            if (!GridManager.Instance.CanPlace(cell.x, cell.y, Furniture.Size)) return false;

            GridManager.Instance.TryPlaceExisting(Item.gameObject, cell.x, cell.y, Furniture.Size);
            Item.GridPosition = cell;

            IsActive = false;
            EventBus.Publish(new PlacementConfirmedEvent { Item = Item, Cell = cell });
            return true;
        }

        public void Cancel()
        {
            IsActive = false;
            EventBus.Publish(new PlacementCancelledEvent());
        }
    }
}
