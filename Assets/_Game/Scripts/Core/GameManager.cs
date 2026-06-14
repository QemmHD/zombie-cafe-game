using UnityEngine;
using ZombieCafe.Audio;
using ZombieCafe.Cafe;
using ZombieCafe.Combat;
using ZombieCafe.Economy;
using ZombieCafe.Zombies;

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

        [Tooltip("Seconds between background autosaves. Guards against data loss if the app is killed without a clean pause/quit.")]
        public float AutosaveInterval = 30f;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start()
        {
            SaveSystem.Load();
            if (AutosaveInterval > 0f)
                InvokeRepeating(nameof(Autosave), AutosaveInterval, AutosaveInterval);
        }

        void Autosave() => SaveSystem.Save();

        // On iOS, backgrounding fires OnApplicationPause(true); OnApplicationQuit is not
        // guaranteed when the OS later kills a suspended app, so pause is the critical save.
        void OnApplicationPause(bool paused)
        {
            if (paused) SaveSystem.Save();
        }

        void OnApplicationFocus(bool focused)
        {
            if (!focused) SaveSystem.Save();
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
