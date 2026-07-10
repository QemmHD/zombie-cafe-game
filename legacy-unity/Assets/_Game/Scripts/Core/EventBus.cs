using System;
using System.Collections.Generic;

namespace ZombieCafe.Core
{
    // Lightweight type-safe event bus. Replaces direct cross-system references.
    // Usage: EventBus.Subscribe<CoinChangedEvent>(OnCoinChanged);
    //        EventBus.Publish(new CoinChangedEvent { Amount = 100 });
    public static class EventBus
    {
        static readonly Dictionary<Type, Delegate> _handlers = new();

        public static void Subscribe<T>(Action<T> handler)
        {
            var t = typeof(T);
            if (_handlers.TryGetValue(t, out var existing))
                _handlers[t] = Delegate.Combine(existing, handler);
            else
                _handlers[t] = handler;
        }

        public static void Unsubscribe<T>(Action<T> handler)
        {
            var t = typeof(T);
            if (_handlers.TryGetValue(t, out var existing))
            {
                var updated = Delegate.Remove(existing, handler);
                if (updated == null) _handlers.Remove(t);
                else _handlers[t] = updated;
            }
        }

        public static void Publish<T>(T evt)
        {
            if (_handlers.TryGetValue(typeof(T), out var handler))
                ((Action<T>)handler)(evt);
        }

        public static void Clear() => _handlers.Clear();
    }

    // ── Event definitions ──────────────────────────────────────────────────────

    public struct CoinsChangedEvent   { public int NewTotal; }
    public struct BrainsChangedEvent  { public int NewTotal; }
    public struct DishReadyEvent      { public Cafe.CookingStation Station; }
    public struct ZombieInfectedEvent { public Cafe.Customer Customer; }
    public struct ZombieAddedEvent    { public Zombies.ZombieInstance Zombie; }
    public struct RaidEndedEvent      { public bool PlayerWon; }
    public struct CafeLevelUpEvent    { public int NewLevel; }
    public struct PlayerLevelUpEvent  { public int NewLevel; }
    public struct NotificationEvent   { public string Message; public float Duration; }
    public struct StationSelectedEvent { public Cafe.CookingStation Station; }
    public struct ItemSelectedEvent    { public Cafe.PlaceableItem  Item; }
    public struct PlacementConfirmedEvent { public Cafe.PlaceableItem Item; public UnityEngine.Vector2Int Cell; }
    public struct PlacementCancelledEvent { }
}
