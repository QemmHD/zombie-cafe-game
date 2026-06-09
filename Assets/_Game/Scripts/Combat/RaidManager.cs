using System;
using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Economy;
using ZombieCafe.Zombies;

namespace ZombieCafe.Combat
{
    // Manages a single raid: spawns player + enemy units, drives combat loop,
    // distributes loot and XP on victory.
    public class RaidManager : MonoBehaviour
    {
        [Header("Spawn Points")]
        public Transform[] PlayerSpawnPoints;
        public Transform[] EnemySpawnPoints;

        [Header("Prefabs")]
        public GameObject ZombiePrefab;

        public bool RaidActive { get; private set; }

        public event Action<bool> OnRaidEnd; // true = player won

        List<CombatUnit> _playerUnits = new();
        List<CombatUnit> _enemyUnits  = new();

        ZombieInventory _inventory;
        CurrencyManager _currency;

        void Start()
        {
            _inventory = FindFirstObjectByType<ZombieInventory>();
            _currency  = FindFirstObjectByType<CurrencyManager>();
        }

        public void BeginRaid(CafeData targetCafe)
        {
            if (RaidActive) return;
            RaidActive = true;

            _playerUnits.Clear();
            _enemyUnits.Clear();

            // Spawn player zombies
            var raiders = _inventory.GetAvailableForRaid();
            for (int i = 0; i < raiders.Count && i < PlayerSpawnPoints.Length; i++)
            {
                var unit = SpawnUnit(raiders[i], Team.Player, PlayerSpawnPoints[i].position);
                _playerUnits.Add(unit);
                raiders[i].Assignment = "raiding";
            }

            // Spawn enemy zombies from target cafe data
            for (int i = 0; i < targetCafe.Defenders.Count && i < EnemySpawnPoints.Length; i++)
            {
                var unit = SpawnUnit(targetCafe.Defenders[i], Team.Enemy, EnemySpawnPoints[i].position);
                _enemyUnits.Add(unit);
            }

            AssignTargets();
        }

        CombatUnit SpawnUnit(ZombieInstance instance, Team team, Vector3 pos)
        {
            var go   = Instantiate(ZombiePrefab, pos, Quaternion.identity);
            var unit = go.AddComponent<CombatUnit>();
            unit.Init(instance, team);
            unit.OnDeath += OnUnitDied;
            return unit;
        }

        void AssignTargets()
        {
            foreach (var p in _playerUnits)
                if (!p.IsDead) p.SetTarget(FindNearest(p, _enemyUnits));

            foreach (var e in _enemyUnits)
                if (!e.IsDead) e.SetTarget(FindNearest(e, _playerUnits));
        }

        CombatUnit FindNearest(CombatUnit from, List<CombatUnit> candidates)
        {
            CombatUnit nearest = null;
            float      minDist = float.MaxValue;
            foreach (var c in candidates)
            {
                if (c.IsDead) continue;
                float d = Vector2.Distance(from.transform.position, c.transform.position);
                if (d < minDist) { minDist = d; nearest = c; }
            }
            return nearest;
        }

        void OnUnitDied(CombatUnit dead)
        {
            dead.OnDeath -= OnUnitDied;
            AssignTargets();

            bool playerAllDead = _playerUnits.TrueForAll(u => u.IsDead);
            bool enemyAllDead  = _enemyUnits.TrueForAll(u => u.IsDead);

            if (playerAllDead || enemyAllDead)
                EndRaid(playerWon: !playerAllDead);
        }

        public void EndRaid()            => EndRaid(playerWon: false);
        void EndRaid(bool playerWon)
        {
            if (!RaidActive) return;
            RaidActive = false;

            foreach (var u in _playerUnits)
            {
                if (u.Instance != null) u.Instance.Assignment = "idle";
                if (!u.IsDead) Destroy(u.gameObject);
            }
            foreach (var u in _enemyUnits)
                if (!u.IsDead) Destroy(u.gameObject);

            if (playerWon)
            {
                _currency.AddCoins(100); // placeholder loot; replace with targetCafe reward table
                foreach (var u in _playerUnits)
                    if (!u.IsDead && u.Instance != null)
                        _inventory.AddXP(u.Instance, 50);
            }

            OnRaidEnd?.Invoke(playerWon);
        }
    }

    [Serializable]
    public class CafeData
    {
        public string              OwnerName;
        public List<ZombieInstance> Defenders = new();
        public int                 CoinLoot;
    }
}
