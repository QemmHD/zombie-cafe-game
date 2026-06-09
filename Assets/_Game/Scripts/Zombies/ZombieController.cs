using UnityEngine;
using ZombieCafe.Zombies;

namespace ZombieCafe.Zombies
{
    // Attached to a zombie GameObject in the scene.
    // Drives the Animator and handles movement to a target position.
    [RequireComponent(typeof(Animator))]
    [RequireComponent(typeof(SpriteRenderer))]
    public class ZombieController : MonoBehaviour
    {
        public ZombieInstance Instance { get; private set; }

        Animator       _anim;
        SpriteRenderer _sr;
        Vector2        _targetPos;
        bool           _moving;

        static readonly int AnimIdle    = Animator.StringToHash("Idle");
        static readonly int AnimWalk    = Animator.StringToHash("Walk");
        static readonly int AnimAttack  = Animator.StringToHash("Attack");
        static readonly int AnimEat     = Animator.StringToHash("Eat");
        static readonly int AnimCook    = Animator.StringToHash("Cook");
        static readonly int AnimDeath   = Animator.StringToHash("Death");
        static readonly int AnimHungry  = Animator.StringToHash("Hungry");

        void Awake()
        {
            _anim = GetComponent<Animator>();
            _sr   = GetComponent<SpriteRenderer>();
        }

        public void Init(ZombieInstance instance)
        {
            Instance = instance;
            if (instance.Data.Animator != null)
                _anim.runtimeAnimatorController = instance.Data.Animator;
            PlayIdle();
        }

        void Update()
        {
            if (!_moving) return;

            Vector2 pos = transform.position;
            Vector2 dir = _targetPos - pos;

            if (dir.magnitude < 0.05f)
            {
                transform.position = _targetPos;
                _moving = false;
                PlayIdle();
                OnReachedTarget?.Invoke();
                return;
            }

            _sr.flipX = dir.x < 0;
            transform.position = Vector2.MoveTowards(pos, _targetPos, Instance.Speed * Time.deltaTime);
        }

        public System.Action OnReachedTarget;

        public void MoveTo(Vector2 worldPos)
        {
            _targetPos = worldPos;
            _moving    = true;
            PlayWalk();
        }

        public void PlayIdle()    => _anim.SetTrigger(AnimIdle);
        public void PlayWalk()    => _anim.SetTrigger(AnimWalk);
        public void PlayAttack()  => _anim.SetTrigger(AnimAttack);
        public void PlayEat()     => _anim.SetTrigger(AnimEat);
        public void PlayCook()    => _anim.SetTrigger(AnimCook);
        public void PlayDeath()   => _anim.SetTrigger(AnimDeath);
        public void PlayHungry()  => _anim.SetTrigger(AnimHungry);
    }
}
