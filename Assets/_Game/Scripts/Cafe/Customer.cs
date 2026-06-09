using System;
using UnityEngine;
using ZombieCafe.Data;

namespace ZombieCafe.Cafe
{
    [RequireComponent(typeof(Animator))]
    [RequireComponent(typeof(SpriteRenderer))]
    public class Customer : MonoBehaviour
    {
        public ZombieData ZombieVariant; // zombie type this customer can become when infected

        Animator              _anim;
        SpriteRenderer        _sr;
        Vector2               _target;
        Action<Customer>      _onFinished;
        CustomerState         _state = CustomerState.Walking;

        float _eatTimer   = 5f;  // seconds spent eating
        float _eatElapsed = 0f;

        static readonly int AnimWalk   = Animator.StringToHash("Walk");
        static readonly int AnimEat    = Animator.StringToHash("Eat");
        static readonly int AnimDeath  = Animator.StringToHash("Death");

        void Awake()
        {
            _anim = GetComponent<Animator>();
            _sr   = GetComponent<SpriteRenderer>();
        }

        public void Init(Vector2 tablePos, Action<Customer> onFinished)
        {
            _target     = tablePos;
            _onFinished = onFinished;
            _anim.SetTrigger(AnimWalk);
        }

        void Update()
        {
            switch (_state)
            {
                case CustomerState.Walking:
                {
                    Vector2 pos = transform.position;
                    Vector2 dir = _target - pos;
                    _sr.flipX = dir.x < 0;

                    if (dir.magnitude < 0.05f)
                    {
                        transform.position = _target;
                        _state = CustomerState.Eating;
                        _anim.SetTrigger(AnimEat);
                    }
                    else
                    {
                        transform.position = Vector2.MoveTowards(pos, _target, 1.5f * Time.deltaTime);
                    }
                    break;
                }
                case CustomerState.Eating:
                {
                    _eatElapsed += Time.deltaTime;
                    if (_eatElapsed >= _eatTimer)
                    {
                        _state = CustomerState.Done;
                        _onFinished?.Invoke(this);
                    }
                    break;
                }
            }
        }

        public void Infect()
        {
            _state = CustomerState.Infected;
            _anim.SetTrigger(AnimDeath);
        }

        enum CustomerState { Walking, Eating, Done, Infected }
    }
}
