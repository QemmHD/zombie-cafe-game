using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using ZombieCafe.Core;

namespace ZombieCafe.UI
{
    // Listens for NotificationEvent and shows floating toast messages.
    // Attach to a Canvas GameObject with a pooled toast prefab.
    public class NotificationManager : MonoBehaviour
    {
        [Header("Setup")]
        public GameObject ToastPrefab;   // TextMeshProUGUI + CanvasGroup + LayoutElement
        public Transform  ToastContainer; // Vertical layout group inside the canvas

        [Header("Animation")]
        public float FadeInTime  = 0.15f;
        public float FadeOutTime = 0.3f;

        static NotificationManager _instance;
        readonly Queue<(string msg, float dur)> _queue = new();
        bool _showing;

        void Awake()
        {
            if (_instance != null && _instance != this) { Destroy(gameObject); return; }
            _instance = this;
        }

        void OnEnable()  => EventBus.Subscribe<NotificationEvent>(OnNotification);
        void OnDisable() => EventBus.Unsubscribe<NotificationEvent>(OnNotification);

        void OnNotification(NotificationEvent e)
        {
            _queue.Enqueue((e.Message, e.Duration > 0f ? e.Duration : 2f));
            if (!_showing) StartCoroutine(ShowNext());
        }

        IEnumerator ShowNext()
        {
            _showing = true;
            while (_queue.Count > 0)
            {
                var (msg, dur) = _queue.Dequeue();
                yield return StartCoroutine(ShowToast(msg, dur));
            }
            _showing = false;
        }

        IEnumerator ShowToast(string message, float duration)
        {
            if (ToastPrefab == null) yield break;   // no prefab wired — GameUIRoot handles toasts
            var go  = Instantiate(ToastPrefab, ToastContainer);
            var tmp = go.GetComponentInChildren<TextMeshProUGUI>();
            var cg  = go.GetComponent<CanvasGroup>();
            if (cg == null) cg = go.AddComponent<CanvasGroup>();
            cg.alpha = 0f;

            if (tmp != null) tmp.text = message;

            // Fade in
            float t = 0f;
            while (t < FadeInTime) { t += Time.deltaTime; cg.alpha = t / FadeInTime; yield return null; }
            cg.alpha = 1f;

            yield return new WaitForSeconds(duration);

            // Fade out
            t = 0f;
            while (t < FadeOutTime) { t += Time.deltaTime; cg.alpha = 1f - t / FadeOutTime; yield return null; }

            Destroy(go);
        }

        // Convenience accessor for code that doesn't use the EventBus path
        public static void Show(string message, float duration = 2f)
            => EventBus.Publish(new NotificationEvent { Message = message, Duration = duration });
    }
}
