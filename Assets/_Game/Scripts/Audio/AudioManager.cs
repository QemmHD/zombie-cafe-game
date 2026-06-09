using UnityEngine;

namespace ZombieCafe.Audio
{
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Header("Sources")]
        public AudioSource MusicSource;
        public AudioSource SFXSource;

        [Header("Music")]
        public AudioClip CafeMusic;
        public AudioClip RaidMusic;
        public AudioClip VictoryStab;
        public AudioClip DefeatStab;

        [Header("SFX")]
        public AudioClip CoinPickup;
        public AudioClip BrainPickup;
        public AudioClip DishReady;
        public AudioClip ZombieInfect;
        public AudioClip AttackHit;
        public AudioClip UnitDeath;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        void Start() => PlayMusic(CafeMusic);

        public void PlayMusic(AudioClip clip)
        {
            if (clip == null || MusicSource.clip == clip) return;
            MusicSource.clip = clip;
            MusicSource.loop = true;
            MusicSource.Play();
        }

        public void PlaySFX(AudioClip clip)
        {
            if (clip == null) return;
            SFXSource.PlayOneShot(clip);
        }
    }
}
