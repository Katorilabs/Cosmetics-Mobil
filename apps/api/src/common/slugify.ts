const turkishCharacters: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (character) => turkishCharacters[character] ?? character)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
