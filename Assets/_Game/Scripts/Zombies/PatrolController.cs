using System.Collections;
using UnityEngine;
using ZombieCafe.Zombies;

namespace ZombieCafe.Zombies
{
    // Drives patrol-assigned zombies wandering the cafe floor.
    // Patrol zombies automatically fight raiders that enter the cafe.
    [RequireComponent(typeof(ZombieController))]
    public class PatrolController : MonoBehaviour
    {
        [Header("Patrol")]
        public float PatrolRadius  = 3f;
        public float WaitMin       = 1f;
        public float WaitMax       = 3f;

        ZombieController _ctrl;
        Vector3          _origin;
        bool             _patrolling;

        void Awake() => _ctrl = GetComponent<ZombieController>();

        void Start()
        {
            _origin = transform.position;
            if (_ctrl.Instance?.Assignment == "patrol")
                StartCoroutine(PatrolLoop());
        }

        IEnumerator PatrolLoop()
        {
            _patrolling = true;
            while (_patrolling)
            {
                Vector2 offset = Random.insideUnitCircle * PatrolRadius;
                Vector2 target = (Vector2)_origin + offset;

                bool reached = false;
                _ctrl.OnReachedTarget = () => reached = true;
                _ctrl.MoveTo(target);

                float timeout = 5f;
                while (!reached && timeout > 0f)
                {
                    timeout -= Time.deltaTime;
                    yield return null;
                }

                yield return new WaitForSeconds(Random.Range(WaitMin, WaitMax));
                _ctrl.PlayIdle();
                yield return new WaitForSeconds(Random.Range(WaitMin, WaitMax));
            }
        }

        public void StopPatrol() => _patrolling = false;

        public void StartPatrol()
        {
            if (!_patrolling)
                StartCoroutine(PatrolLoop());
        }
    }
}
