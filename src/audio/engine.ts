// 共通の音声エンジン（設計書 4-4）。
// アプリ全体でこの1つだけを使い、各画面は「この音を鳴らして」と頼むだけにする。
//
// スマホ（特に iPhone）では、ユーザーが画面をタップしたときにしか音を出し始められない。
// そのため、再生の命令は必ずボタンのクリックなどから呼び出す（内部で unlock() を行う）。

import type * as ToneNS from 'tone';
import { createDrumKit, createInstrument, type DrumKit, type Instrument, type InstrumentId } from './instruments';
import { beatsToSeconds, midiToFrequency, volumeToDb } from './frequency';

export interface PlayOptions {
  instrument?: InstrumentId;
  /** 音の長さ（秒） */
  duration?: number;
  /** 強さ 0〜1 */
  velocity?: number;
}

/** 時間差で鳴らす音（秒で指定） */
interface TimedNote {
  midis: number[];
  at: number;
  duration: number;
  instrument?: InstrumentId;
  velocity?: number;
  drum?: number;
}

export interface SequenceEvent {
  midis: number[];
  /** 開始位置（拍） */
  startBeat: number;
  /** 長さ（拍） */
  durationBeats: number;
  instrument?: InstrumentId;
  velocity?: number;
  /** ドラムの音（GM ドラム番号）。指定したときは midis は使わない */
  drum?: number;
}

class AudioEngine {
  private tone: typeof ToneNS | null = null;
  private loading: Promise<typeof ToneNS> | null = null;
  private master: ToneNS.Volume | null = null;
  private instruments = new Map<InstrumentId, Instrument>();
  private drumKit: DrumKit | null = null;
  private volume = 0.8;
  private defaultInstrument: InstrumentId = 'piano';
  private listeners = new Set<() => void>();
  private playingUntil = 0;
  private endTimer: number | undefined;

  /** Tone.js は大きいので、最初に音を鳴らすときに読み込む */
  private async load(): Promise<typeof ToneNS> {
    if (this.tone) return this.tone;
    this.loading ??= import('tone').then((Tone) => {
      this.tone = Tone;
      this.master = new Tone.Volume(volumeToDb(this.volume)).toDestination();
      return Tone;
    });
    return this.loading;
  }

  /** 音を出せる状態にする（タップなどの操作の中で呼ぶ） */
  async unlock(): Promise<typeof ToneNS> {
    const Tone = await this.load();
    if (Tone.getContext().state !== 'running') await Tone.start();
    // ピアノの録音（約2MB）は、最初に音を出したときから裏で読み込み始める
    if (!this.instruments.has('piano')) this.instrument('piano');
    return Tone;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master) this.master.volume.rampTo(volumeToDb(volume), 0.05);
  }

  setDefaultInstrument(id: InstrumentId) {
    this.defaultInstrument = id;
  }

  private instrument(id: InstrumentId | undefined): Instrument {
    const key = id ?? this.defaultInstrument;
    let inst = this.instruments.get(key);
    if (!inst) {
      inst = createInstrument(this.tone!, key, this.master!);
      this.instruments.set(key, inst);
    }
    return inst;
  }

  /**
   * 1音、または複数の音を同時に今すぐ鳴らす（MIDI 番号で指定）。
   * 鍵盤をタップしたときなどに使う。鳴っている他の音は止めない。
   */
  async play(midis: number | number[], opts: PlayOptions = {}): Promise<void> {
    const list = Array.isArray(midis) ? midis : [midis];
    if (list.length === 0) return;
    const Tone = await this.unlock();
    const duration = opts.duration ?? 1.2;
    const at = Tone.now() + 0.01;
    this.instrument(opts.instrument).triggerAttackRelease(
      list.map((m) => midiToFrequency(m)),
      duration,
      at,
      opts.velocity ?? 0.8,
    );
    this.playingUntil = Math.max(this.playingUntil, at + duration);
    this.emit();
    window.clearTimeout(this.endTimer);
    this.endTimer = window.setTimeout(() => this.emit(), (this.playingUntil - Tone.now()) * 1000 + 100);
  }

  /** ドラムの音を1回鳴らす（ドラム入力のときの試し聴き用） */
  async playDrum(drum: number, velocity = 0.9): Promise<void> {
    const Tone = await this.unlock();
    this.drumKit ??= createDrumKit(Tone, this.master!);
    this.drumKit.trigger(drum, Tone.now() + 0.01, velocity);
  }

  /** コードを和音で鳴らす（前に鳴っていた音は止める） */
  async chord(midis: number[], opts: PlayOptions = {}): Promise<void> {
    if (midis.length === 0) return;
    await this.schedule([{ midis, at: 0, duration: opts.duration ?? 1.6, ...opts }]);
  }

  /** 分散和音（下の音から順番に鳴らす） */
  async arpeggio(midis: number[], opts: PlayOptions & { gap?: number } = {}): Promise<void> {
    const gap = opts.gap ?? 0.2;
    const sorted = [...midis].sort((a, b) => a - b);
    const last = (sorted.length - 1) * gap;
    await this.schedule(
      sorted.map((m, i) => ({ midis: [m], at: i * gap, duration: (opts.duration ?? 0.8) + (last - i * gap), ...opts })),
    );
  }

  /** 2つの音を順番に鳴らしてから同時に鳴らす（音程の比較用） */
  async compare(a: number, b: number, opts: PlayOptions = {}): Promise<void> {
    const d = opts.duration ?? 0.8;
    await this.schedule([
      { midis: [a], at: 0, duration: d, ...opts },
      { midis: [b], at: d + 0.1, duration: d, ...opts },
      { midis: [a, b], at: (d + 0.1) * 2, duration: d * 1.5, ...opts },
    ]);
  }

  /**
   * コード進行などを BPM に合わせて再生する。戻り値は全体の長さ（秒）。
   * loop を指定すると、lengthBeats 拍ごとに最初から繰り返す（停止するまで続く）。
   */
  async playSequence(
    events: SequenceEvent[],
    bpm: number,
    opts: { loop?: boolean; lengthBeats?: number } = {},
  ): Promise<number> {
    const notes = events.map((e) => ({
      midis: e.midis,
      at: beatsToSeconds(e.startBeat, bpm),
      duration: beatsToSeconds(e.durationBeats, bpm) * 0.95,
      instrument: e.instrument,
      velocity: e.velocity,
      drum: e.drum,
    }));
    const length = opts.lengthBeats !== undefined ? beatsToSeconds(opts.lengthBeats, bpm) : undefined;
    await this.schedule(notes, opts.loop && length ? length : undefined);
    return length ?? Math.max(0, ...notes.map((n) => n.at + n.duration));
  }

  /** 前の再生を止めてから、音を予約して鳴らす。loopSeconds があればその長さで繰り返す */
  private async schedule(notes: TimedNote[], loopSeconds?: number): Promise<void> {
    const Tone = await this.unlock();
    this.stop(false);
    const transport = Tone.getTransport();
    for (const n of notes) {
      if (n.drum !== undefined) {
        this.drumKit ??= createDrumKit(Tone, this.master!);
        const kit = this.drumKit;
        const drum = n.drum;
        transport.schedule((time) => kit.trigger(drum, time, n.velocity ?? 0.8), n.at);
        continue;
      }
      if (n.midis.length === 0) continue;
      const inst = this.instrument(n.instrument);
      const freqs = n.midis.map((m) => midiToFrequency(m));
      transport.schedule((time) => inst.triggerAttackRelease(freqs, n.duration, time, n.velocity ?? 0.8), n.at);
    }
    if (notes.length === 0) return;
    if (loopSeconds) {
      transport.loop = true;
      transport.loopStart = 0;
      transport.loopEnd = loopSeconds;
    } else {
      transport.loop = false;
    }
    transport.start(Tone.now() + 0.03, 0);
    window.clearTimeout(this.endTimer);
    if (loopSeconds) {
      this.playingUntil = Number.POSITIVE_INFINITY;
    } else {
      const total = Math.max(...notes.map((n) => n.at + n.duration));
      this.playingUntil = Tone.now() + total + 0.03;
      this.endTimer = window.setTimeout(() => this.emit(), total * 1000 + 100);
    }
    this.emit();
  }

  /** 再生位置（秒）。ループ中は繰り返しの中での位置。再生していなければ null */
  get positionSeconds(): number | null {
    if (!this.tone || !this.isPlaying) return null;
    const transport = this.tone.getTransport();
    return transport.state === 'started' ? transport.seconds : null;
  }

  /** すべての音を止める */
  stop(notify = true) {
    const Tone = this.tone;
    if (!Tone) return;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.loop = false;
    for (const inst of this.instruments.values()) inst.releaseAll();
    this.playingUntil = 0;
    window.clearTimeout(this.endTimer);
    if (notify) this.emit();
  }

  /** 再生中かどうか（「停止」ボタンの表示用） */
  get isPlaying(): boolean {
    return !!this.tone && this.tone.now() < this.playingUntil;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

/** アプリ全体で共有する、ただ1つの音声エンジン */
export const audio = new AudioEngine();
