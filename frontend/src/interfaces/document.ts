import type { SixQuestionAnswers } from '../services/govclearSixQuestions';

export type Locale = 'zh-TW' | 'id';
export type FileKind = 'photos' | 'pdf';
export type FilingStatus = 'due-soon' | 'completed';

export interface AppContext {
  locale: Locale;
  embedded: boolean;
  showHeader: boolean;
}

export interface OriginalFile {
  name: string;
  blob: Blob;
}

export interface Summary {
  title: string;
  facts: string[];
  action: string;
}

export interface ServiceDestination {
  id: string;
  kind: 'official' | 'townpass';
  label: Record<Locale, string>;
  target?: string;
}

export interface ChatExchange {
  question: string;
  answer: string;
  locale: Locale;
}

export interface DocumentRecord {
  id: string;
  hash: string | null;
  fixtureId?: string;
  kind: FileKind;
  createdAt: number;
  originals: OriginalFile[];
  pages: Blob[];
  summary: Summary;
  source?: string;
  sixQuestions?: SixQuestionAnswers;
  locale: Locale;
  status?: FilingStatus;
  scenarioDate?: string;
  destinations: ServiceDestination[];
  chat: ChatExchange[];
}

export type RecordCard = Pick<
  DocumentRecord,
  'id' | 'kind' | 'createdAt' | 'summary' | 'status' | 'scenarioDate'
> & { pageCount: number };

export interface Fixture {
  hash: string;
  id: string;
  file: string;
  kind: FileKind;
  date: string;
  summaries: Record<Locale, Summary>;
  status?: FilingStatus;
  scenarioDate?: string;
  destinations: ServiceDestination[];
}
