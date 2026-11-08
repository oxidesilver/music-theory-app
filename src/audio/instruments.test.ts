import { describe, expect, it } from 'vitest';
import { SAMPLE_CREDITS, pianoSampleUrls } from './instruments';
import { midiOf, parsePitch } from '@/theory/pitch';

// プロジェクトに収録されている音源ファイルの一覧（Vite の機能でファイル名だけを取得する）
const onDisk = Object.keys(import.meta.glob('../../public/samples/piano/*')).map((p) => p.split('/').pop()!);

describe('ピアノ音源', () => {
  it('A0〜C8 を短3度おき（A・C・D♯・F♯）に、30個の音源がある', () => {
    const urls = pianoSampleUrls();
    expect(Object.keys(urls)).toHaveLength(30);
    const midis = Object.keys(urls)
      .map((n) => midiOf(parsePitch(n)))
      .sort((a, b) => a - b);
    expect(midis[0]).toBe(21); // A0
    expect(midis.at(-1)).toBe(108); // C8
    // 隣り合う録音の間は短3度（3半音）
    expect(midis.slice(1).every((m, i) => m - midis[i]! === 3)).toBe(true);
  });

  it('対応表のファイルがすべてプロジェクトに収録されている（余分な音源ファイルも無い）', () => {
    const files = Object.values(pianoSampleUrls()).sort();
    expect(onDisk.filter((f) => f.endsWith('.mp3')).sort()).toEqual(files);
  });

  it('ライセンスの条件どおり、作者名とライセンスを表示する情報がある', () => {
    expect(SAMPLE_CREDITS[0]).toMatchObject({ name: 'Salamander Grand Piano', author: 'Alexander Holm', license: 'CC BY 3.0' });
    expect(onDisk).toContain('LICENSE.txt');
  });
});
