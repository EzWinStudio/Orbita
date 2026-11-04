import type { LanguageCode } from '../types';
import { en } from './en';
import type { TranslationRow } from './dicts/shell';
import { shellRows } from './dicts/shell';
import { businessRows } from './dicts/business';
import { workRows } from './dicts/work';
import { mailRows } from './dicts/mail';
import { modalsRows } from './dicts/modals';
import { youtubeRows } from './dicts/youtube';
import { studioRows } from './dicts/studio';
import { operationsRows } from './dicts/operations';
import { webRows } from './dicts/web';

type TranslationKey = keyof typeof en;

const CODES: readonly LanguageCode[] = ['de', 'es', 'fr', 'pt', 'ru', 'ar', 'zh', 'ja'];

const rows: readonly TranslationRow[] = [
  ...shellRows,
  ...businessRows,
  ...workRows,
  ...mailRows,
  ...modalsRows,
  ...youtubeRows,
  ...studioRows,
  ...operationsRows,
  ...webRows,
];

type Dictionary = Partial<Record<TranslationKey, string>>;

export const extraDictionaries: Partial<Record<LanguageCode, Dictionary>> = {};

for (const row of rows) {
  const [key, ...values] = row;
  CODES.forEach((code, index) => {
    const dictionary = (extraDictionaries[code] ??= {});
    dictionary[key] = values[index];
  });
}

export const translationRowCount = rows.length;
