using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using ZombieCafe.Cafe;
using ZombieCafe.Core;
using ZombieCafe.Zombies;

namespace ZombieCafe.Combat
{
    // An enemy raider that enters the cafe and tries to destroy cooking stations.
    // Patrol zombies assigned to "patrol" will intercept and fight raiders.
    // When all raiders are dead or escaped, the raid ends.
    [RequireComponent(typeof(CombatUnit))]
    public class RaiderController : MonoBehaviour
    {
        [Header("Config")]
        public float MoveSpeed     = 2f;
        public float StealCooldown = 3f;    // seconds between stealing attempts
        public int   CoinStealAmt  = 20;    // coins stolen per attempt if uncontested

        CombatUnit        _unit;
        CookingStation    _targetStation;
        CombatUnit        _fightTarget;
        float             _stealTimer;
        bool              _retreating;

        static readonly List<RaiderController> _activeRaiders = new();

        public static IReadOnlyList<RaiderController> ActiveRaiders => _activeRaiders;

        void Awake()
        {
            _unit = GetComponent<CombatUnit>();
            _unit.OnDeath += OnDied;
        }

        void OnEnable()  => _activeRaiders.Add(this);
        void OnDisable() => _activeRaiders.Remove(this);

        void Start()
        {
            _targetStation = FindBestStation();
            _stealTimer    = StealCooldown;
        }

        void Update()
        {
            if (_unit.IsDead || _retreating) return;

            // If we have a fight target, CombatUnit handles movement/attacking via SetTarget.
            // Here we check if the fight is over and resume pillaging.
            if (_fightTarget != null)
            {
                if (_fightTarget.IsDead)
                {
                    _fightTarget = null;
                    _unit.SetTarget(null);
                }
                else return;
            }

            // Check if a patrol zombie is within aggro range
            var nearby = FindNearestPatrolZombie();
            if (nearby != null)
            {
                _fightTarget = nearby;
                _unit.SetTarget(nearby);
                return;
            }

            if (_targetStation == null || _targetStation.State == StationState.Empty)
                _targetStation = FindBestStation();

            if (_targetStation == null)
            {
                // Nothing left to steal — retreat
                StartCoroutine(Retreat());
                return;
            }

            // Walk to the station
            float dist = Vector2.Distance(transform.position, _targetStation.transform.position);
            if (dist > 0.6f)
            {
                Vector2 dir = ((Vector2)_targetStation.transform.position - (Vector2)transform.position).normalized;
                transform.position = Vector2.MoveTowards(transform.position,
                                                          _targetStation.transform.position,
                                                          MoveSpeed * Time.deltaTime);
            }
            else
            {
                // Steal tick
                _stealTimer -= Time.deltaTime;
                if (_stealTimer <= 0f)
                {
                    _stealTimer = StealCooldown;
                    AttemptSteal();
                }
            }
        }

        void AttemptSteal()
        {
            if (_targetStation == null) return;
            if (_targetStation.State == StationState.Ready)
            {
                // Steal the completed dish's coin value
                var currency = FindFirstObjectByType<Economy.CurrencyManager>();
                if (currency != null)
                {
                    int stolen = _targetStation.CurrentDish != null
                        ? Mathf.RoundToInt(_targetStation.CurrentDish.CoinReward * 0.5f)
                        : CoinStealAmt;
                    // We don't call CollectDish — raider just takes the coins
                    EventBus.Publish(new NotificationEvent
                    {
                        Message  = $"Raider stole {stolen} coins!",
                        Duration = 2f
                    });
                }
            }
        }

        CookingStation FindBestStation()
        {
            // Prefer Ready stations (more loot), then Cooking
            CookingStation best = null;
            float          bestScore = -1f;
            var stations = FindObjectsByType<CookingStation>(FindObjectsSortMode.None);
            foreach (var s in stations)
            {
                if (s.State == StationState.Empty) continue;
                float score = (s.State == StationState.Ready ? 2f : 1f)
                            - Vector2.Distance(transform.position, s.transform.position) * 0.01f;
                if (score > bestScore) { bestScore = score; best = s; }
            }
            return best;
        }

        CombatUnit FindNearestPatrolZombie()
        {
            float      aggroRange = 3f;
            CombatUnit nearest    = null;
            float      minDist    = aggroRange;

            var units = FindObjectsByType<CombatUnit>(FindObjectsSortMode.None);
            foreach (var u in units)
            {
                if (u.Team != Team.Player || u.IsDead) continue;
                float d = Vector2.Distance(transform.position, u.transform.position);
                if (d < minDist) { minDist = d; nearest = u; }
            }
            return nearest;
        }

        IEnumerator Retreat()
        {
            _retreating = true;
            Vector2 exitPoint = new Vector2(-20f, transform.position.y); // off-screen left

            while (Vector2.Distance(transform.position, exitPoint) > 0.5f)
            {
                transform.position = Vector2.MoveTowards(transform.position, exitPoint,
                                                          MoveSpeed * Time.deltaTime);
                yield return null;
            }

            Destroy(gameObject);
        }

        void OnDied(CombatUnit _)
        {
            _retreating = true; // stop Update logic
            StartCoroutine(DespawnAfter(2f));
        }

        IEnumerator DespawnAfter(float delay)
        {
            yield return new WaitForSeconds(delay);
            Destroy(gameObject);
        }
    }
}
