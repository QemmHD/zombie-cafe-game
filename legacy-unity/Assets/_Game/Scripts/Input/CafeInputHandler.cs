using UnityEngine;
using UnityEngine.InputSystem;
using ZombieCafe.Cafe;

namespace ZombieCafe.Input
{
    // Unified tap/click handler for the cafe scene.
    // Routes taps to: CookingStation, CafeTable, PlaceableItem, or camera pan.
    public class CafeInputHandler : MonoBehaviour
    {
        Camera _cam;
        bool   _placementMode = false;
        Core.PlacementSession _session;

        void Awake() => _cam = Camera.main;

        void Update()
        {
            if (!TryGetTap(out Vector2 screenPos)) return;

            Vector3 world = _cam.ScreenToWorldPoint(new Vector3(screenPos.x, screenPos.y, _cam.nearClipPlane));
            world.z = 0;

            if (_placementMode)
            {
                HandlePlacement(world);
                return;
            }

            // Raycast for interactive objects
            var hit = Physics2D.OverlapPoint(world);
            if (hit == null) return;

            if (hit.TryGetComponent<CookingStation>(out var station))
            {
                OnStationTapped(station);
            }
            else if (hit.TryGetComponent<CafeTable>(out var table))
            {
                OnTableTapped(table);
            }
            else if (hit.TryGetComponent<PlaceableItem>(out var item))
            {
                OnItemTapped(item);
            }
        }

        bool TryGetTap(out Vector2 screenPos)
        {
            // Supports both old and new input system at runtime
            if (Touchscreen.current != null && Touchscreen.current.primaryTouch.press.wasPressedThisFrame)
            {
                screenPos = Touchscreen.current.primaryTouch.position.ReadValue();
                return true;
            }
            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame)
            {
                screenPos = Mouse.current.position.ReadValue();
                return true;
            }
            screenPos = default;
            return false;
        }

        void OnStationTapped(CookingStation station)
        {
            if (station.State == StationState.Ready)
                station.CollectDish();
            else if (station.State == StationState.Empty)
                Core.EventBus.Publish(new Core.StationSelectedEvent { Station = station });
        }

        void OnTableTapped(CafeTable table) { /* future: show table info */ }

        void OnItemTapped(PlaceableItem item)
            => Core.EventBus.Publish(new Core.ItemSelectedEvent { Item = item });

        void HandlePlacement(Vector3 worldPos)
        {
            if (_session == null) return;
            var cell = GridManager.Instance.WorldToGrid(worldPos);
            _session.TryConfirm(cell.x, cell.y);
        }

        public void EnterPlacementMode(Core.PlacementSession session)
        {
            _session       = session;
            _placementMode = true;
        }

        public void ExitPlacementMode()
        {
            _session       = null;
            _placementMode = false;
        }
    }
}
