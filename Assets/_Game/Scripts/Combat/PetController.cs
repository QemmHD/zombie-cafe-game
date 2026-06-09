using System.Collections;
using UnityEngine;
using ZombieCafe.Data;

namespace ZombieCafe.Combat
{
    // Controls a special pet unit in combat.
    // Pets have unique abilities triggered on cooldown.
    [RequireComponent(typeof(Animator))]
    [RequireComponent(typeof(SpriteRenderer))]
    public class PetController : MonoBehaviour
    {
        public PetData Data    { get; private set; }
        public int     Level   { get; private set; } = 1;
        public int     CurrentHP { get; private set; }

        Animator       _anim;
        SpriteRenderer _sr;
        float          _abilityCooldown = 0f;

        static readonly int AnimIdle   = Animator.StringToHash("Idle");
        static readonly int AnimAttack = Animator.StringToHash("Attack");
        static readonly int AnimAbility= Animator.StringToHash("Ability");
        static readonly int AnimDeath  = Animator.StringToHash("Death");

        public bool IsDead => CurrentHP <= 0;

        void Awake()
        {
            _anim = GetComponent<Animator>();
            _sr   = GetComponent<SpriteRenderer>();
        }

        public void Init(PetData data, int level)
        {
            Data      = data;
            Level     = level;
            CurrentHP = data.GetHP(level);
            if (data.Animator != null) _anim.runtimeAnimatorController = data.Animator;
            _anim.SetTrigger(AnimIdle);
        }

        void Update()
        {
            if (IsDead) return;
            _abilityCooldown -= Time.deltaTime;
            if (_abilityCooldown <= 0f) TriggerAbility();
        }

        void TriggerAbility()
        {
            _abilityCooldown = Data.AbilityCooldown;
            _anim.SetTrigger(AnimAbility);
            StartCoroutine(ApplyAbilityAfter(0.3f));
        }

        IEnumerator ApplyAbilityAfter(float delay)
        {
            yield return new WaitForSeconds(delay);
            switch (Data.Ability)
            {
                case PetAbility.AreaAttack:
                    var hits = Physics2D.OverlapCircleAll(transform.position, 2.5f);
                    foreach (var h in hits)
                    {
                        var unit = h.GetComponent<CombatUnit>();
                        if (unit != null && unit.Team == Team.Enemy)
                            unit.TakeDamage(Data.GetAttack(Level));
                    }
                    break;

                case PetAbility.Tornado:
                    var enemies = FindObjectsByType<CombatUnit>(FindObjectsSortMode.None);
                    foreach (var e in enemies)
                        if (e.Team == Team.Enemy && !e.IsDead)
                            e.transform.position += (e.transform.position - transform.position).normalized * 2f;
                    break;

                // Other abilities handled by their specific subclasses or animation events
            }
        }

        public void TakeDamage(int amount)
        {
            CurrentHP = Mathf.Max(0, CurrentHP - amount);
            if (CurrentHP == 0) _anim.SetTrigger(AnimDeath);
        }
    }
}
