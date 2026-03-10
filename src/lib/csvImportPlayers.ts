import { CSV_PLAYER_HEADERS } from './constants';

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
  isCapped: boolean;
}

const toBool = (value: string | boolean | undefined) => String(value ?? '').trim().toLowerCase() === 'true';

const normalize = (value: string | undefined) => String(value ?? '').trim();

export const parsePlayersCsv = (csvText: string): CsvPlayerRow[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((h) => h.trim());

  const orderValid = CSV_PLAYER_HEADERS.every((key, index) => headers[index] === key);
  if (!orderValid) {
    console.error('CSV column order invalid');
    throw new Error(`Invalid CSV headers. Expected order: ${CSV_PLAYER_HEADERS.join(',')}`);
  }

  return rows
    .map((line) => line.split(',').map((cell) => cell.trim()))
    .map((cells) => ({
      name: normalize(cells[0]),
      role: normalize(cells[1]),
      rating: Number(cells[2] || 0),
      basePrice: Number(cells[3] || 0),
      pool: normalize(cells[4]),
      previousTeamId: normalize(cells[5]) || null,
      overseas: toBool(cells[6]),
      nationality: normalize(cells[7]),
      image: normalize(cells[8]),
      isCapped: toBool(cells[9]),
    }))
    .filter(
      (row) =>
        row.name &&
        row.role &&
        row.pool &&
        Number.isFinite(row.rating) &&
        Number.isFinite(row.basePrice),
    );
};
