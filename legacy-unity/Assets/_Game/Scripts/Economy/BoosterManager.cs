using System;
using UnityEngine;
using ZombieCafe.Core;
using ZombieCafe.Data;

namespace ZombieCafe.Economy
{
    public class BoosterManager : MonoBehaviour
    {
        public static BoosterManager Instance { get; private set; }

        public float ActiveMultiplier { get; private set; } = 1f;
        public float TimeRemaining    { get; private set; } = 0f;
        public bool  IsActive         => TimeRemaining > 0f;

        public event Action<float> OnBoosterActivated;  // passes multiplier
        public event Action        OnBoosterExpired;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        void Update()
        {
            if (!IsActive) return;
            TimeRemaining -= Time.deltaTime;
            if (TimeRemaining <= 0f)
            {
                TimeRemaining    = 0f;
                ActiveMultiplier = 1f;
                OnBoosterExpired?.Invoke();
                EventBus.Publish(new NotificationEvent { Message = "Booster expired!", Duration = 2f });
            }
        }

        public bool Activate(BoosterData booster, CurrencyManager currency)
        {
            if (!currency.SpendBrains(booster.BuyCost)) return false;

            // Stack duration if same tier is already active; otherwise replace
            if (IsActive && ActiveMultiplier == booster.CookSpeedMultiplier)
                TimeRemaining += booster.DurationSeconds;
            else
            {
                ActiveMultiplier = booster.CookSpeedMultiplier;
                TimeRemaining    = booster.DurationSeconds;
            }

            OnBoosterActivated?.Invoke(ActiveMultiplier);
            EventBus.Publish(new NotificationEvent { Message = $"{booster.DisplayName} active! {booster.CookSpeedMultiplier}x speed", Duration = 3f });
            return true;
        }

        // Called by CookingStation to get effective cook time
        public float ApplyToTime(float baseCookTime) => baseCookTime / ActiveMultiplier;
    }
}
