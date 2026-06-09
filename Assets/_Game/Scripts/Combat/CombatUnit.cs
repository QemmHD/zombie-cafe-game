using System;
using System.Collections;
using UnityEngine;
using ZombieCafe.Zombies;

namespace ZombieCafe.Combat
{
    public enum Team { Player, Enemy }

    // CombatUnit no longer RequireComponent ZombieController:
    // player units have one, AI raiders may not.
    public class CombatUnit : MonoBehaviour
    {
        public Team   Team      { get; private set; }
        public int    MaxHP     { get; private set; }
        public int    CurrentHP { get; private set; }
        public bool   IsDead    => CurrentHP <= 0;

        // Null for AI-only units (raiders without a ZombieData backing).
        public ZombieInstance Instance { get; private set; }

        public event Action<CombatUnit> OnDeath;
        public event Action<int, int>   OnHPChanged; // (current, max)

        ZombieController _controller;
        CombatUnit       _currentTarget;
        float            _attackCooldown = 0f;
        float            _attackRate     = 1.5f;
        int              _attackDamage   = 10;

        void Awake() => _controller = GetComponent<ZombieController>(); // null-safe on raiders

        // Initialise from a ZombieInstance (player units, named zombies)
        public void Init(ZombieInstance instance, Team team)
        {
            Instance      = instance;
            Team          = team;
            MaxHP         = instance.CurrentHP;
            CurrentHP     = MaxHP;
            _attackDamage = instance.Attack;
            _attackRate   = 1f / (instance.Data.BaseSpeed * 0.5f);
            _controller?.Init(instance);
        }

        // Initialise a raw-stat raider (no ZombieInstance, no animator required)
        public void InitRaider(int hp, int attack)
        {
            Team          = Team.Enemy;
            MaxHP         = hp;
            CurrentHP     = hp;
            _attackDamage = attack;
            _attackRate   = 1.5f;
        }

        public void SetTarget(CombatUnit target) => _currentTarget = target;

        void Update()
        {
            if (IsDead || _currentTarget == null || _currentTarget.IsDead) return;

            _attackCooldown -= Time.deltaTime;

            float dist = Vector2.Distance(transform.position, _currentTarget.transform.position);
            if (dist > 1.2f)
            {
                _controller?.MoveTo(_currentTarget.transform.position);
            }
            else if (_attackCooldown <= 0f)
            {
                _controller?.PlayAttack();
                _attackCooldown = _attackRate;
                StartCoroutine(DealDamageAfter(0.3f));
            }
        }

        IEnumerator DealDamageAfter(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (_currentTarget != null && !_currentTarget.IsDead)
                _currentTarget.TakeDamage(_attackDamage);
        }

        public void TakeDamage(int amount)
        {
            if (IsDead) return;
            CurrentHP = Mathf.Max(0, CurrentHP - amount);
            OnHPChanged?.Invoke(CurrentHP, MaxHP);
            if (CurrentHP == 0) Die();
        }

        void Die()
        {
            _controller?.PlayDeath();
            OnDeath?.Invoke(this);
        }
    }
}
