import { describe, expect, it } from 'vitest';
import { cleanQuote, createAnchor, locateQuote } from '../../src/citations/anchors';

describe('原文锚点', () => {
  it('跨行编辑清理不改变原文，不猜测断词或公式', () => {
    const raw = 'Across lines\nremain well-\nknown.';
    expect(cleanQuote(raw)).toBe('Across lines remain well- known.');
    expect(raw).toContain('\n'); expect(cleanQuote('中文\n选段')).toBe('中文选段');
  });
  it('字符位置和上下文正确时匹配原文', () => {
    const text = 'before\nquoted words\nafter'; const start = text.indexOf('quoted');
    expect(locateQuote(text, 'quoted words', createAnchor(text, start, start + 12))).toEqual({ start, end: start + 12 });
  });
  it('旧位置失效时只回退到唯一的原文匹配', () => {
    const anchor = createAnchor('before quoted after', 7, 13);
    expect(locateQuote('new prefix quoted after', 'quoted', anchor)).toEqual({ start: 11, end: 17 });
  });
  it('重复文本不猜测，高亮必须通过位置与上下文校验', () => {
    const text = 'left same right same end'; const anchor = createAnchor(text, 5, 9);
    expect(locateQuote(text, 'same', anchor)).toEqual({ start: 5, end: 9 });
    expect(locateQuote(text, 'same', { ...anchor, start: 16, end: 20 })).toBeNull();
  });
  it('缺失原文、空文本和未知锚点版本不匹配', () => {
    const anchor = createAnchor('original', 0, 8);
    expect(locateQuote('changed', 'original', anchor)).toBeNull();
    expect(locateQuote('original', '', anchor)).toBeNull();
    expect(locateQuote('original', 'original', { ...anchor, version: 2 as 1 })).toBeNull();
  });
});
