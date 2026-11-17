import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDictation } from './dictation';
import { entryFromDictation } from './entry';
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web' }, registerPlugin: () => ({}) }));
const transcript = 'Call Maria Friday at 10';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function mockSpeech() {
  let instance: any;
  class Recognizer {
    abort = vi.fn(); stop = vi.fn(); start = vi.fn();
    constructor() { instance = this; }
  }
  vi.stubGlobal('window', { SpeechRecognition: Recognizer });
  vi.stubGlobal('navigator', { onLine: true, language: 'en-US' });
  return () => instance;
}
describe('dictation entries', () => {
  it('keeps an ambiguous date as text for review instead of guessing', () => {
    expect(entryFromDictation(transcript, 'todo')).toEqual({ intent: 'todo', transcript, todo: { title: transcript, due_at: null } });
  });
  it('appends notes without creating an accidental new customer', () => {
    expect(entryFromDictation('  Prefers wide shoes  ', 'customer')).toEqual({ intent: 'note', transcript: 'Prefers wide shoes', note_append: 'Prefers wide shoes' });
  });
  it('requires the user to select an intent for a global entry', () => {
    expect(entryFromDictation('new customer Maria', 'global').intent).toBe('unknown');
  });
});
describe('speech lifecycle', () => {
  it('preserves recognized words and waits for completion', async () => {
    const current = mockSpeech();
    const session = startDictation();
    current().onresult({ results: [Object.assign([{ transcript }], { isFinal: true })] });
    session.stop(); expect(current().stop).toHaveBeenCalledOnce();
    current().onend();
    await expect(session.result).resolves.toBe(transcript);
  });
  it('provides an actionable permission message', async () => {
    const current = mockSpeech(); const session = startDictation();
    current().onerror({ error: 'not-allowed' });
    await expect(session.result).rejects.toThrow('Allow microphone access');
  });
  it('cancels and releases the recognizer when leaving the page', async () => {
    const current = mockSpeech(); const session = startDictation(); session.cancel();
    await expect(session.result).rejects.toThrow('canceled');
    expect(current().abort).toHaveBeenCalledOnce();
  });
  it('does not leave a failed recognition spinning forever', async () => {
    vi.useFakeTimers(); const current = mockSpeech(); const session = startDictation();
    const rejected = expect(session.result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(60000); await rejected;
    expect(current().abort).toHaveBeenCalledOnce();
  });
  it('fails clearly when recognition is unsupported', () => {
    vi.stubGlobal('window', {});
    expect(() => startDictation()).toThrow('keyboard');
  });
});
