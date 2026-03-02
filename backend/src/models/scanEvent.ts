export type ScanEventStatus =
  | 'received'
  | 'validated'
  | 'committed'
  | 'rejected'
  | 'error';

export interface ScanEvent {
  scanId: string;
  uid: string;
  userId?: number | null;
  rfidTagId?: number | null;
  status: ScanEventStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  beerBuId?: number | null;
  score?: number | null;
  source?: string | null;
  scannedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConsumeCurrentRequest {
  scanId: string;
  uid: string;
  scannedAt?: string;
  source?: string;
}

export interface ConsumeCurrentResponse {
  message: string;
  status: 'committed' | 'rejected_final' | 'retryable_error';
  scanId: string;
  id?: number;
  score?: number;
  userId?: number;
  duplicate?: boolean;
  code?: string;
}

export interface TeamRankingEntry {
  teamId: number;
  teamName: string;
  points: number;
}

export interface UserScoreEntry {
  utilisateurId: number;
  firstName: string;
  points: number;
}

export interface ScoreStreamPayload {
  eventId: string;
  scanId: string;
  committedAt: string;
  ranking: TeamRankingEntry[];
  teamId: number | null;
  teamName: string | null;
  teamPoints: number | null;
  userScores: UserScoreEntry[];
  bestTeamId: number | null;
  bestTeamName: string | null;
  bestTeamPoints: number | null;
  bestTeamUsers: UserScoreEntry[];
}
