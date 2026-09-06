export type ClueType =
  | "person"
  | "place"
  | "brand"
  | "animal"
  | "food"
  | "pop_culture"
  | "object";

export interface ImageClueSeed {
  id: string;
  type: ClueType;
  category: string;
  subject: string;
  answer_hebrew: string;
  aliases_hebrew: string;
  country: string;
  recognition: number;
  difficulty: number;
  israeli_relevance: number;
  global_relevance: number;
  image_source: string;
  source_url: string;
  author: string;
  license: string;
  s3_key: string;
  active: boolean;
  notes: string;
}

export interface CommonsCandidate {
  id: string;
  clueId: string;
  title: string;
  pageId?: number;
  descriptionUrl: string;
  originalUrl: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  mime?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
  credit?: string;
  description?: string;
  attributionRequired: boolean;
  allowed: boolean;
  rejectReason?: string;
  searchQuery: string;
}

export interface ApprovalRecord {
  clueId: string;
  candidateId: string;
  approvedAt: string;
}
