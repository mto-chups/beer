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

export interface FunRaceEntry {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  liters: number;
  litersPerHour: number;
  drinks: number;
  lastDrinkAt: string | null;
}

export interface FunSprintEntry {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  liters: number;
  litersPerHour: number;
  windowMinutes: number;
  startAt: string | null;
  endAt: string | null;
}

export interface FunStatsPayload {
  generatedAt: string;
  liveWindowMinutes: number;
  sprintWindowMinutes: number;
  liveRace: FunRaceEntry[];
  bestSprints: FunSprintEntry[];
  biggestTanks: FunRaceEntry[];
}

export interface TeamWeatherEntry {
  teamId: number;
  teamName: string;
  liters: number;
  previousLiters: number;
  intensity: 'low' | 'medium' | 'high' | 'extreme';
  phenomenon: string;
  trend: string;
  bulletin: string;
}

export interface MarketEntry {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  currentIndex: number;
  litersPerHour: number;
  currentLiters: number;
  previousLiters: number;
  variationPct: number;
  volatility: number;
  label: string;
}

export interface RadarEntry {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  litersPerHour: number;
  status: string;
  notice: string;
  lastDrinkAt: string | null;
}

export interface RaceSkinEntry extends FunRaceEntry {
  mount: string;
  commentary: string;
  progressPct: number;
}

export interface TourEntry extends FunRaceEntry {
  jersey: string | null;
  gapLitersPerHour: number;
  stageNote: string;
}

export interface FunLiveStatsPayload {
  generatedAt: string;
  windows: {
    shortMinutes: number;
    liveMinutes: number;
    marketMinutes: number;
  };
  liveRace: FunRaceEntry[];
  teamWeather: TeamWeatherEntry[];
  marketBoard: MarketEntry[];
  radarBoard: RadarEntry[];
  horseRace: RaceSkinEntry[];
  tourBoard: TourEntry[];
}

export interface FunMedicalUserEntry {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  currentBac: number;
  peakBac: number;
  totalDrinks: number;
  totalAlcoholGrams: number;
  lastDrinkAt: string | null;
  controlStatus: string;
  controlHeadline: string;
  healthWarnings: string[];
  engineTempLevel: number;
  warningLights: string[];
}

export interface FunMedicalStatsPayload {
  generatedAt: string;
  spotlightUsers: FunMedicalUserEntry[];
}

export interface FunProfileEntry {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  headline: string;
  skills: string[];
  endorsements: number;
  careerStats: {
    litersTotal: number;
    drinksTotal: number;
    favoriteBeerType: string | null;
    activeDays: number;
  };
}

export interface FunDatingEntry {
  userId: number;
  firstName: string;
  teamName: string | null;
  favoriteBeerType: string | null;
  favoriteBeerBrand: string | null;
  matchScore: number;
  lookingFor: string;
  bio: string;
  greenFlags: string[];
}

export interface FunSocialStatsPayload {
  generatedAt: string;
  profiles: FunProfileEntry[];
  datingCards: FunDatingEntry[];
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
