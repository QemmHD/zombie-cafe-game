using UnityEngine;

namespace ZombieCafe.Core
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Systems")]
        public CurrencyManager Currency;
        public ZombieInventory  ZombieInventory;
        public CafeManager      Cafe;
        public RaidManager      Raids;
        public AudioManager     Audio;

        public GameState State { get; private set; } = GameState.Cafe;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start()
        {
            SaveSystem.Load();
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) SaveSystem.Save();
        }

        void OnApplicationQuit()
        {
            SaveSystem.Save();
        }

        public void EnterRaidMode(CafeData targetCafe)
        {
            State = GameState.Raid;
            Raids.BeginRaid(targetCafe);
        }

        public void ExitRaidMode()
        {
            State = GameState.Cafe;
            Raids.EndRaid();
        }
    }

    public enum GameState { Cafe, Raid, Store, ZombiePedia }
}
