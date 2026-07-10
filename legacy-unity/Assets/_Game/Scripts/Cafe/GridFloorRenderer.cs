using UnityEngine;

namespace ZombieCafe.Cafe
{
    // Draws coloured floor tiles for every grid cell. No prefabs required.
    public class GridFloorRenderer : MonoBehaviour
    {
        static readonly Color TileA = new Color(0.18f, 0.13f, 0.10f);
        static readonly Color TileB = new Color(0.14f, 0.10f, 0.07f);

        GridManager _grid;
        GameObject  _root;
        int         _builtW, _builtH;

        void Start()
        {
            _grid = GridManager.Instance;
            _root = new GameObject("FloorTiles");
            _root.transform.SetParent(transform, false);
            Rebuild();
        }

        void Update()
        {
            if (_grid != null && (_grid.Width != _builtW || _grid.Height != _builtH))
                Rebuild();
        }

        void Rebuild()
        {
            if (_grid == null) return;
            foreach (Transform c in _root.transform) Destroy(c.gameObject);

            _builtW = _grid.Width;
            _builtH = _grid.Height;

            var sprite = MakeSprite();
            float cs = _grid.CellSize;

            for (int y = 0; y < _builtH; y++)
            for (int x = 0; x < _builtW;  x++)
            {
                var tile = new GameObject($"t{x}_{y}");
                tile.transform.SetParent(_root.transform, false);
                tile.transform.position = _grid.GridToWorld(x, y);
                tile.transform.localScale = new Vector3(cs * 0.97f, cs * 0.5f * 0.97f, 1f);

                var sr = tile.AddComponent<SpriteRenderer>();
                sr.sprite       = sprite;
                sr.color        = (x + y) % 2 == 0 ? TileA : TileB;
                sr.sortingOrder = -10;
            }

            // Grid border outline
            DrawBorder(sprite, cs);
        }

        void DrawBorder(Sprite sprite, float cs)
        {
            // Top / bottom / left / right edge highlights
            var borderColor = new Color(0.35f, 0.22f, 0.12f, 0.6f);
            for (int x = 0; x < _builtW; x++)
            {
                SpawnEdge(sprite, _grid.GridToWorld(x, _builtH - 1) + Vector3.up * cs * 0.25f,
                          new Vector3(cs * 0.97f, 0.06f, 1f), borderColor, -9);
                SpawnEdge(sprite, _grid.GridToWorld(x, 0) - Vector3.up * cs * 0.25f,
                          new Vector3(cs * 0.97f, 0.06f, 1f), borderColor, -9);
            }
            for (int y = 0; y < _builtH; y++)
            {
                SpawnEdge(sprite, _grid.GridToWorld(0, y) - Vector3.right * cs * 0.5f,
                          new Vector3(0.06f, cs * 0.5f * 0.97f, 1f), borderColor, -9);
                SpawnEdge(sprite, _grid.GridToWorld(_builtW - 1, y) + Vector3.right * cs * 0.5f,
                          new Vector3(0.06f, cs * 0.5f * 0.97f, 1f), borderColor, -9);
            }
        }

        void SpawnEdge(Sprite sprite, Vector3 pos, Vector3 scale, Color color, int order)
        {
            var go = new GameObject("Edge");
            go.transform.SetParent(_root.transform, false);
            go.transform.position   = pos;
            go.transform.localScale = scale;
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite       = sprite;
            sr.color        = color;
            sr.sortingOrder = order;
        }

        static Sprite MakeSprite()
        {
            var tex = new Texture2D(2, 2);
            tex.SetPixels(new[] { Color.white, Color.white, Color.white, Color.white });
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, 2, 2), new Vector2(0.5f, 0.5f), 2f);
        }
    }
}
