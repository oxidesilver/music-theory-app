// 音色の定義（設計書 4-4）。
// - ピアノ：本物のピアノの録音（Salamander Grand Piano・CC-BY 3.0）。読み込みが終わるまではシンセのピアノ風の音で鳴らす
// - シンセ・ベース：Tone.js のシンセサイザー
import type * as ToneNS from 'tone';

export type InstrumentId = 'piano' | 'synth' | 'bass';

export const INSTRUMENT_INFO: Record<InstrumentId, { nameJa: string; description: string }> = {
  piano: { nameJa: 'ピアノ', description: '本物のグランドピアノの録音（Salamander Grand Piano）' },
  synth: { nameJa: 'シンセ', description: 'のこぎり波の、明るく伸びのある音' },
  bass: { nameJa: 'ベース', description: '低音向けの、太く短い音' },
};

/** ドラムの音（GM ドラムの番号：36 キック、38 スネア、39 クラップ、42 ハイハット閉、46 ハイハット開） */
export interface DrumKit {
  trigger: (drum: number, time: number, velocity: number) => void;
}

export function createDrumKit(Tone: typeof ToneNS, destination: ToneNS.InputNode): DrumKit {
  const out = new Tone.Volume(-4).connect(destination);
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 } }).connect(out);
  const snareFilter = new Tone.Filter({ frequency: 1800, type: 'bandpass', Q: 0.8 }).connect(out);
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } }).connect(snareFilter);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(out);
  snareBody.volume.value = -10;
  const clapFilter = new Tone.Filter({ frequency: 1200, type: 'bandpass', Q: 1.2 }).connect(out);
  const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0 } }).connect(clapFilter);
  const hatFilter = new Tone.Filter({ frequency: 8000, type: 'highpass' }).connect(out);
  const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(hatFilter);
  const openHat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(hatFilter);
  hat.volume.value = -12;
  openHat.volume.value = -14;

  return {
    trigger(drum, time, velocity) {
      switch (drum) {
        case 36:
          kick.triggerAttackRelease('C1', 0.3, time, velocity);
          break;
        case 38:
          snare.triggerAttackRelease(0.15, time, velocity);
          snareBody.triggerAttackRelease('G2', 0.1, time, velocity);
          break;
        case 39:
          clap.triggerAttackRelease(0.12, time, velocity);
          break;
        case 46:
          openHat.triggerAttackRelease(0.25, time, velocity);
          break;
        default:
          hat.triggerAttackRelease(0.04, time, velocity);
      }
    },
  };
}

/** 鳴らせる音色（シンセもサンプル音源も同じ使い方にそろえる） */
export interface Instrument {
  triggerAttackRelease: (frequencies: number[], duration: number, time: number, velocity: number) => void;
  releaseAll: () => void;
}

/** ピアノ音源のファイル（短3度おきに録音された A・C・D♯・F♯）。足りない高さは近い録音の高さを変えて鳴らす */
export function pianoSampleUrls(): Record<string, string> {
  const urls: Record<string, string> = { A0: 'A0.mp3', C8: 'C8.mp3' };
  for (let octave = 1; octave <= 7; octave++) {
    urls[`A${octave}`] = `A${octave}.mp3`;
    urls[`C${octave}`] = `C${octave}.mp3`;
    urls[`D#${octave}`] = `Ds${octave}.mp3`;
    urls[`F#${octave}`] = `Fs${octave}.mp3`;
  }
  return urls;
}

/** 使用している音源のクレジット（ライセンスの条件として表示する） */
export const SAMPLE_CREDITS = [
  {
    name: 'Salamander Grand Piano',
    author: 'Alexander Holm',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    note: 'ピアノの音色に使用（Tone.js の配布する MP3 版）',
  },
];

/** ピアノ：サンプル音源を読み込み、読み込み中・失敗時はシンセのピアノ風の音で鳴らす */
function createPiano(Tone: typeof ToneNS, destination: ToneNS.InputNode): Instrument {
  const fallback = createSynthPiano(Tone, destination);
  let sampler: ToneNS.Sampler | null = null;
  let ready = false;
  try {
    sampler = new Tone.Sampler({
      urls: pianoSampleUrls(),
      baseUrl: `${import.meta.env.BASE_URL}samples/piano/`,
      release: 1.2,
      onload: () => {
        ready = true;
      },
      onerror: () => {
        ready = false;
      },
    }).connect(destination);
    sampler.volume.value = -4;
  } catch {
    sampler = null;
  }
  return {
    triggerAttackRelease(frequencies, duration, time, velocity) {
      if (ready && sampler) sampler.triggerAttackRelease(frequencies, duration, time, velocity);
      else fallback.triggerAttackRelease(frequencies, duration, time, velocity);
    },
    releaseAll() {
      fallback.releaseAll();
      if (ready && sampler) sampler.releaseAll();
    },
  };
}

/** シンセで作ったピアノ風の音（サンプル音源の読み込み中・読み込めなかったときに使う） */
function createSynthPiano(Tone: typeof ToneNS, destination: ToneNS.InputNode): ToneNS.PolySynth {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2,
    modulationIndex: 1.5,
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 1.2, sustain: 0.15, release: 1.2 },
    modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.8 },
  });
  synth.maxPolyphony = 32;
  synth.volume.value = -8;
  return synth.connect(destination);
}

/** 音色を作る。出力は destination（音量つまみ）につなぐ */
export function createInstrument(Tone: typeof ToneNS, id: InstrumentId, destination: ToneNS.InputNode): Instrument {
  switch (id) {
    case 'piano':
      return createPiano(Tone, destination);
    case 'synth': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.6 },
      });
      synth.maxPolyphony = 32;
      synth.volume.value = -18;
      const filter = new Tone.Filter({ frequency: 3200, type: 'lowpass', rolloff: -24 }).connect(destination);
      return synth.connect(filter);
    }
    case 'bass': {
      const synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'square' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.3 },
        filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.4, baseFrequency: 120, octaves: 2.6 },
      });
      synth.maxPolyphony = 8;
      synth.volume.value = -10;
      return synth.connect(destination);
    }
  }
}
