using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Economy;
using ZombieCafe.Zombies;

namespace ZombieCafe.Combat
{
    // Spawns incoming raider waves on a timer.
    // Uses patrol zombies (Assignment == "patrol") as defenders.
    // When all raiders are dead or the wave timer expires, awards loot.
    public class CafeDefenseManager : MonoBehaviour
    {
        [Header("Wave Config")]
        public float FirstWaveDelay  = 120f;  // seconds after scene load before first raid
        public float WaveInterval    = 180f;  // seconds between raids
        public int   BaseRaiderCount = 2;     // raiders at cafe level 1
        public GameObject RaiderPrefab;       // must have RaiderController + CombatUnit

        [Header("Spawn Points")]
        public Transform[] RaiderSpawnPoints;

        ZombieInventory _inventory;
        // _waveActive removed — wave sequencing is handled by coroutine flow

        void Start()
        {
            _inventory = FindFirstObjectByType<ZombieInventory>();
            StartCoroutine(WaveLoop());
        }

        IEnumerator WaveLoop()
        {
            yield return new WaitForSeconds(FirstWaveDelay);

            while (true)
            {
                yield return StartCoroutine(RunWave());
                yield return new WaitForSeconds(WaveInterval);
            }
        }

        IEnumerator RunWave()
        {
            if (RaiderPrefab == null || RaiderSpawnPoints.Length == 0) yield break;

            int cafeLevel   = SaveSystem.Current.CafeLevel;
            int raiderCount = BaseRaiderCount + (cafeLevel - 1);

            EventBus.Publish(new NotificationEvent { Message = "Raiders approaching!", Duration = 3f });

            var spawned = new List<RaiderController>();
            for (int i = 0; i < raiderCount; i++)
            {
                var spawn = RaiderSpawnPoints[i % RaiderSpawnPoints.Length];
                var go    = Instantiate(RaiderPrefab, spawn.position, Quaternion.identity);

                // Initialise the CombatUnit with a scaled raider instance
                var unit    = go.GetComponent<CombatUnit>();
                var raider  = go.GetComponent<RaiderController>();
                if (unit != null)
                {
                    int hp  = 60 + cafeLevel * 10;
                    int atk =  8 + cafeLevel *  2;
                    unit.InitRaider(hp, atk);
                }

                if (raider != null) spawned.Add(raider);
            }

            // Wait until all raiders are gone
            while (spawned.Exists(r => r != null && !r.GetComponent<CombatUnit>().IsDead))
                yield return new WaitForSeconds(0.5f);

            EventBus.Publish(new NotificationEvent { Message = "Raiders repelled!", Duration = 3f });

            // Award defence bonus
            var currency = FindFirstObjectByType<Economy.CurrencyManager>();
            if (currency != null)
            {
                int reward = 50 + (cafeLevel - 1) * 10;
                currency.AddCoins(reward);
            }
        }
    }
}
