using UnityEngine;
using UnityEngine.SceneManagement;

namespace ZombieCafe.Core
{
    // Loaded in the Boot scene (index 0).
    // Initialises global services and loads the main cafe scene.
    public class BootstrapManager : MonoBehaviour
    {
        [Header("Scene Names")]
        public string MainSceneName = "Main";

        void Awake()
        {
            // Load or create a fresh save before anything else touches SaveSystem
            SaveSystem.Load();
        }

        void Start()
        {
            SceneManager.LoadScene(MainSceneName);
        }
    }
}
