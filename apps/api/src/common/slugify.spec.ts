import { slugify } from './slugify.js';

describe('slugify', () => {
  it('normalizes Turkish characters and whitespace', () => {
    expect(slugify('  Yağlı Cilt Çözümü  ')).toBe('yagli-cilt-cozumu');
  });
});
