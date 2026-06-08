const KEY = 'undead-diner-save-v1';

export class SaveSystem {
  write(data: any) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  }
  read(): any | null {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  }
  clear() { try { localStorage.removeItem(KEY); } catch {} }
}
