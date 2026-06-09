using System;
using System.Collections;
using UnityEngine;
using ZombieCafe.Zombies;

namespace ZombieCafe.Combat
{
    public enum Team { Player, Enemy }

    [RequireComponent(typeof(ZombieController))]
    public class CombatUnit : MonoBehaviour
    {
        public Team   Team      { get; private set; }
        public int    MaxHP     { get; private set; }
        public int    CurrentHP { get; private set; }
        public bool   IsDead    => CurrentHP <= 0;

        public event Action<CombatUnit> OnDeath;
        public event Action<int, int>   OnHPChanged; // (current, max)

        ZombieController _controller;
        CombatUnit       _currentTarget;
        float            _attackCooldown = 0f;
        float            _attackRate     = 1.5f; // attacks per second

        void Awake() => _controller = GetComponent<ZombieController>();

        public void Init(ZombieInstance instance, Team team)
        {
            Team      = team;
            MaxHP     = instance.CurrentHP;
            CurrentHP = MaxHP;
            _attackRate = 1f / (instance.Data.BaseSpeed * 0.5f);
            _controller.Init(instance);
        }

        public void SetTarget(CombatUnit target) => _currentTarget = target;

        void Update()
        {
            if (IsDead || _currentTarget == null || _currentTarget.IsDead) return;

            _attackCooldown -= Time.deltaTime;

            float dist = Vector2.Distance(transform.position, _currentTarget.transform.position);
            if (dist > 1.2f)
            {
                _controller.MoveTo(_currentTarget.transform.position);
            }
            else if (_attackCooldown <= 0f)
            {
                _controller.PlayAttack();
                _attackCooldown = _attackRate;
                // Damage lands mid-animation via animation event, but we apply it here for simplicity
                StartCoroutine(DealDamageAfter(0.3f));
            }
        }

        IEnumerator DealDamageAfter(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (_currentTarget != null && !_currentTarget.IsDead)
                _currentTarget.TakeDamage(_controller.Instance.Attack);
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
            _controller.PlayDeath();
            OnDeath?.Invoke(this);
        }
    }
}
