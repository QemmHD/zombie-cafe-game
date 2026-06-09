using System.Collections;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Zombies;

namespace ZombieCafe.Cafe
{
    // Spawns human customers that walk to a table, eat, and have a chance to get infected.
    public class CustomerSpawner : MonoBehaviour
    {
        [Header("Config")]
        public GameObject CustomerPrefab;
        public Transform[] SpawnPoints;
        public Transform[] TablePoints;

        [Header("Timing")]
        public float MinSpawnInterval = 8f;
        public float MaxSpawnInterval = 20f;

        ZombieInventory _inventory;

        void Start()
        {
            _inventory = FindFirstObjectByType<ZombieInventory>();
            StartCoroutine(SpawnLoop());
        }

        IEnumerator SpawnLoop()
        {
            while (true)
            {
                yield return new WaitForSeconds(Random.Range(MinSpawnInterval, MaxSpawnInterval));
                if (GameManager.Instance.State == GameState.Cafe)
                    SpawnCustomer();
            }
        }

        void SpawnCustomer()
        {
            if (SpawnPoints.Length == 0 || TablePoints.Length == 0) return;

            Transform spawnPt = SpawnPoints[Random.Range(0, SpawnPoints.Length)];
            Transform tablePt = TablePoints[Random.Range(0, TablePoints.Length)];

            var go = Instantiate(CustomerPrefab, spawnPt.position, Quaternion.identity);
            var customer = go.GetComponent<Customer>();
            customer.Init(tablePt.position, OnCustomerFinished);
        }

        void OnCustomerFinished(Customer customer)
        {
            // Calculate infection chance from all kitchen zombies
            float infectionChance = 0f;
            foreach (var z in _inventory.Zombies)
            {
                if (z.Assignment == "kitchen")
                    infectionChance = Mathf.Min(1f, infectionChance + z.Data.InfectionChance);
            }

            if (Random.value < infectionChance)
            {
                customer.Infect();
                // After infection animation, add a common zombie from this customer type
                StartCoroutine(ConvertAfterDelay(customer, 2f));
            }
            else
            {
                Destroy(customer.gameObject, 1f);
            }
        }

        IEnumerator ConvertAfterDelay(Customer customer, float delay)
        {
            yield return new WaitForSeconds(delay);
            // Spawn a new zombie of the customer's type if inventory has space
            if (customer.ZombieVariant != null)
                _inventory.AddZombie(customer.ZombieVariant);
            Destroy(customer.gameObject);
        }
    }
}
