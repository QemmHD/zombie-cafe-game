using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Core;

namespace ZombieCafe.Cafe
{
    // Manages the isometric cafe floor grid.
    // World origin (0,0) = bottom-left grid cell.
    // Grid expands up to 16x17 via CafeExpansion.
    public class GridManager : MonoBehaviour
    {
        public static GridManager Instance { get; private set; }

        [Header("Grid Settings")]
        public float CellSize = 1.0f;       // world units per tile
        public int   StartWidth  = 7;
        public int   StartHeight = 8;

        public int Width  { get; private set; }
        public int Height { get; private set; }

        // True = cell is occupied by a placed item
        bool[,] _occupied;

        // Map from grid position to placed GameObject
        readonly Dictionary<Vector2Int, GameObject> _placements = new();

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Start()
        {
            Width  = SaveSystem.Current.GridWidth;
            Height = SaveSystem.Current.GridHeight;
            _occupied = new bool[Width, Height];
        }

        // ── Query ──────────────────────────────────────────────────────────────

        public bool IsInBounds(int x, int y) => x >= 0 && x < Width && y >= 0 && y < Height;
        public bool IsOccupied(int x, int y) => IsInBounds(x, y) && _occupied[x, y];

        public bool CanPlace(int x, int y, Vector2Int size)
        {
            for (int dx = 0; dx < size.x; dx++)
            for (int dy = 0; dy < size.y; dy++)
            {
                if (!IsInBounds(x + dx, y + dy)) return false;
                if (_occupied[x + dx, y + dy])   return false;
            }
            return true;
        }

        // ── Placement ─────────────────────────────────────────────────────────

        public bool TryPlace(GameObject prefab, int x, int y, Vector2Int size, out GameObject placed)
        {
            placed = null;
            if (!CanPlace(x, y, size)) return false;

            placed = Instantiate(prefab, GridToWorld(x, y), Quaternion.identity);
            MarkOccupied(x, y, size, placed);
            return true;
        }

        // Places an already-instantiated GameObject onto the grid (used by PlacementSession).
        public bool TryPlaceExisting(GameObject existing, int x, int y, Vector2Int size)
        {
            if (!CanPlace(x, y, size)) return false;
            existing.transform.position = GridToWorld(x, y);
            MarkOccupied(x, y, size, existing);
            return true;
        }

        public void Remove(int x, int y)
        {
            if (!_placements.TryGetValue(new Vector2Int(x, y), out var go)) return;
            var pi = go.GetComponent<PlaceableItem>();
            if (pi != null) ClearOccupied(x, y, pi.Size);
            Destroy(go);
        }

        // ── World <-> Grid ────────────────────────────────────────────────────

        public Vector3 GridToWorld(int x, int y) =>
            new Vector3(x * CellSize, y * CellSize * 0.5f, -y * 0.01f); // slight z-sort

        public Vector2Int WorldToGrid(Vector3 worldPos)
        {
            int x = Mathf.FloorToInt(worldPos.x / CellSize);
            int y = Mathf.FloorToInt(worldPos.y / (CellSize * 0.5f));
            return new Vector2Int(x, y);
        }

        // ── Grid expansion ────────────────────────────────────────────────────

        public bool Expand(int newWidth, int newHeight)
        {
            if (newWidth <= Width && newHeight <= Height) return false;
            var old = _occupied;
            _occupied = new bool[newWidth, newHeight];
            for (int x = 0; x < Width;  x++)
            for (int y = 0; y < Height; y++)
                _occupied[x, y] = old[x, y];
            Width  = newWidth;
            Height = newHeight;
            SaveSystem.Current.GridWidth  = Width;
            SaveSystem.Current.GridHeight = Height;
            return true;
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        void MarkOccupied(int x, int y, Vector2Int size, GameObject go)
        {
            for (int dx = 0; dx < size.x; dx++)
            for (int dy = 0; dy < size.y; dy++)
            {
                _occupied[x + dx, y + dy] = true;
                _placements[new Vector2Int(x + dx, y + dy)] = go;
            }
        }

        void ClearOccupied(int x, int y, Vector2Int size)
        {
            for (int dx = 0; dx < size.x; dx++)
            for (int dy = 0; dy < size.y; dy++)
            {
                _occupied[x + dx, y + dy] = false;
                _placements.Remove(new Vector2Int(x + dx, y + dy));
            }
        }
    }
}
