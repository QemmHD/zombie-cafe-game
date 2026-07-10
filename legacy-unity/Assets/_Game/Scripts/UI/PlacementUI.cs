using UnityEngine;
using UnityEngine.UI;
using ZombieCafe.Cafe;
using ZombieCafe.Core;
using ZombieCafe.Data;
using ZombieCafe.Input;

namespace ZombieCafe.UI
{
    // Activated when the player wants to place a furniture item.
    // Shows a ghost preview that snaps to the grid; Confirm / Cancel buttons.
    public class PlacementUI : MonoBehaviour
    {
        [Header("References")]
        public CafeInputHandler InputHandler;
        public Button           ConfirmButton;
        public Button           CancelButton;
        public GameObject       GhostPrefab;   // Semi-transparent sprite placeholder

        Camera     _cam;
        GameObject _ghost;
        PlacementSession _session;
        FurnitureData    _furniture;
        bool             _pendingConfirm;
        Vector2Int       _lastCell;

        void Awake()
        {
            _cam = Camera.main;
            ConfirmButton.onClick.AddListener(OnConfirm);
            CancelButton.onClick.AddListener(OnCancel);
            gameObject.SetActive(false);
        }

        void OnEnable()
        {
            EventBus.Subscribe<PlacementConfirmedEvent>(OnConfirmed);
            EventBus.Subscribe<PlacementCancelledEvent>(OnCancelled);
        }

        void OnDisable()
        {
            EventBus.Unsubscribe<PlacementConfirmedEvent>(OnConfirmed);
            EventBus.Unsubscribe<PlacementCancelledEvent>(OnCancelled);
        }

        // Call from ShopUI / Store when player buys a furniture item
        public void BeginPlacement(FurnitureData furniture, PlaceableItem item)
        {
            _furniture = furniture;
            _session   = new PlacementSession(item, furniture);
            InputHandler.EnterPlacementMode(_session);

            if (GhostPrefab != null)
            {
                _ghost = Instantiate(GhostPrefab);
                var sr = _ghost.GetComponent<SpriteRenderer>();
                if (sr != null) sr.color = new Color(1f, 1f, 1f, 0.5f);
            }

            ConfirmButton.interactable = false;
            gameObject.SetActive(true);
        }

        void Update()
        {
            if (_session == null || !_session.IsActive) return;

            // Follow pointer to show ghost at grid-snapped position
            Vector2 screenPos = GetPointerScreen();
            if (screenPos == Vector2.negativeInfinity) return;

            Vector3 world = _cam.ScreenToWorldPoint(new Vector3(screenPos.x, screenPos.y, _cam.nearClipPlane));
            world.z = 0f;

            var cell = GridManager.Instance.WorldToGrid(world);
            bool canPlace = GridManager.Instance.CanPlace(cell.x, cell.y, _furniture.Size);

            if (_ghost != null)
            {
                _ghost.transform.position = GridManager.Instance.GridToWorld(cell.x, cell.y);
                var sr = _ghost.GetComponent<SpriteRenderer>();
                if (sr != null) sr.color = canPlace
                    ? new Color(0f, 1f, 0f, 0.5f)
                    : new Color(1f, 0f, 0f, 0.5f);
            }

            _lastCell = cell;
            ConfirmButton.interactable = canPlace;
        }

        void OnConfirm()
        {
            if (_session == null) return;
            _session.TryConfirm(_lastCell.x, _lastCell.y);
        }

        void OnCancel()
        {
            _session?.Cancel();
        }

        void OnConfirmed(PlacementConfirmedEvent e) => Cleanup();
        void OnCancelled(PlacementCancelledEvent e) => Cleanup();

        void Cleanup()
        {
            InputHandler.ExitPlacementMode();
            if (_ghost != null) { Destroy(_ghost); _ghost = null; }
            _session  = null;
            _furniture = null;
            gameObject.SetActive(false);
        }

        Vector2 GetPointerScreen()
        {
            var ts = UnityEngine.InputSystem.Touchscreen.current;
            if (ts != null && ts.primaryTouch.press.isPressed)
                return ts.primaryTouch.position.ReadValue();
            var ms = UnityEngine.InputSystem.Mouse.current;
            if (ms != null) return ms.position.ReadValue();
            return Vector2.negativeInfinity;
        }
    }
}
