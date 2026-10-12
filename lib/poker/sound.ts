/** WebAudio による簡易効果音（ユーザー操作後に init すること） */
export class SoundFX {
  private ctx: AudioContext | null = null;
  on = true;

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        /* AudioContext 使用不可 */
      }
    }
  }

  private tone(
    f: number,
    dur = 0.08,
    type: OscillatorType = "triangle",
    vol = 0.12,
    when = 0
  ) {
    if (!this.on || !this.ctx) return;
    try {
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      /* 再生失敗は無視 */
    }
  }

  card() {
    this.tone(660, 0.05, "triangle", 0.07);
  }
  chip() {
    this.tone(1180, 0.05, "sine", 0.1);
    this.tone(1560, 0.06, "sine", 0.07, 0.05);
  }
  fold() {
    this.tone(190, 0.1, "sine", 0.09);
  }
  click() {
    this.tone(880, 0.04, "square", 0.04);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, "triangle", 0.11, i * 0.1));
  }
  lose() {
    this.tone(220, 0.25, "sine", 0.1);
    this.tone(165, 0.3, "sine", 0.1, 0.18);
  }
}
