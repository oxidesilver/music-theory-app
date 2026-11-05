import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PianoKeyboard } from './PianoKeyboard';

vi.mock('@/audio/engine', () => ({ audio: { play: vi.fn(async () => {}) } }));
import { audio } from '@/audio/engine';

describe('ピアノ鍵盤', () => {
  it('C4〜B5 の2オクターブで 24 個の鍵盤（白鍵14・黒鍵10）を表示する', () => {
    render(<PianoKeyboard from={60} to={83} keyName={(m) => `key-${m}`} />);
    expect(screen.getAllByRole('button')).toHaveLength(24);
  });

  it('鍵盤を押すと、その音の MIDI 番号が通知され、音が鳴る', () => {
    const onKeyPress = vi.fn();
    render(<PianoKeyboard from={60} to={71} onKeyPress={onKeyPress} keyName={(m) => `key-${m}`} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'key-64' }));
    expect(onKeyPress).toHaveBeenCalledWith(64);
    expect(audio.play).toHaveBeenCalledWith(64, expect.anything());
  });

  it('印を付けた鍵盤に音名が表示される', () => {
    render(<PianoKeyboard from={60} to={71} marks={{ 60: { kind: 'root', label: 'C' }, 64: { kind: 'chord', label: 'E' } }} />);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('黒鍵から始まる範囲は、ひとつ下の白鍵から表示する', () => {
    render(<PianoKeyboard from={61} to={64} />);
    expect(screen.getAllByRole('button')).toHaveLength(5); // C4〜E4
  });
});
