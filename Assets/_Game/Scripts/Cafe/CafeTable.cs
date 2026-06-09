using System;
using System.Collections.Generic;
using UnityEngine;

namespace ZombieCafe.Cafe
{
    // A table with N seats. Customers occupy seats while eating.
    public class CafeTable : MonoBehaviour
    {
        [Header("Config")]
        public int SeatCount = 2;

        public int AvailableSeats => SeatCount - _occupied.Count;

        readonly List<Customer> _occupied = new();

        public event Action<CafeTable> OnSeatFreed;

        public bool TryOccupySeat(Customer customer)
        {
            if (_occupied.Count >= SeatCount) return false;
            _occupied.Add(customer);
            return true;
        }

        public void FreeSeat(Customer customer)
        {
            _occupied.Remove(customer);
            OnSeatFreed?.Invoke(this);
        }

        public Vector3 GetSeatWorldPos(int seatIndex)
        {
            float spacing = 0.4f;
            float offset  = (seatIndex - (SeatCount - 1) * 0.5f) * spacing;
            return transform.position + new Vector3(offset, -0.3f, 0);
        }
    }
}
