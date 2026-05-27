import { readFile } from "fs/promises";
import path from "path";

export type BibleVerse = {
  t: string;
  i: string;
  w: string;
};

let cache: BibleVerse[] | null = null;

async function loadVerses(): Promise<BibleVerse[]> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "public/bible-json/k_bible_1950_dos_kr.json");
  const raw = await readFile(filePath, "utf-8");
  cache = JSON.parse(raw) as BibleVerse[];
  return cache;
}

export async function getRandomBibleVerse(): Promise<BibleVerse> {
  const verses = await loadVerses();
  return verses[Math.floor(Math.random() * verses.length)]!;
}
