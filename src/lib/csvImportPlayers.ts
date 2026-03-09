export interface CsvPlayerRow {
  name: string;
  role: string;
  rating: number;
  basePrice: number;
  pool: string;
  previousTeamId: string | null;
  overseas: boolean;
  nationality: string;
  image: string;
}

const toBool = (value: string) => String(value || '').trim().toLowerCase() === 'true';

export const parsePlayersCsv = (csvText: string): CsvPlayerRow[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((h) => h.trim());

  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const nameI = idx('name');
  const roleI = idx('role');
  const ratingI = idx('rating');
  const basePriceI = idx('basePrice');
  const poolI = idx('pool');
  const previousTeamIdI = idx('previousTeamId');
  const overseasI = idx('overseas');
  const nationalityI = idx('nationality');
  const imageI = idx('image');

  if ([nameI, roleI, ratingI, basePriceI, poolI, previousTeamIdI, overseasI, nationalityI, imageI].some((i) => i < 0)) {
    throw new Error('Invalid CSV headers. Expected: name,role,rating,basePrice,pool,previousTeamId,overseas,nationality,image');
  }

  return rows
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .map((cells) => ({
      name: String(cells[nameI] || ''),
      role: String(cells[roleI] || ''),
      rating: Number(cells[ratingI] || 0),
      basePrice: Number(cells[basePriceI] || 0),
      pool: String(cells[poolI] || ''),
      previousTeamId: cells[previousTeamIdI] ? String(cells[previousTeamIdI]) : null,
      overseas: toBool(String(cells[overseasI] || 'false')),
      nationality: String(cells[nationalityI] || ''),
      image: String(cells[imageI] || ''),
    }))
    .filter((row) => row.name && row.role && Number.isFinite(row.rating) && Number.isFinite(row.basePrice));
};
