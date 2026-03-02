import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2';
import { db } from '../config/db';
import {
  FunDatingEntry,
  FunLiveStatsPayload,
  FunMedicalStatsPayload,
  FunMedicalUserEntry,
  FunProfileEntry,
  FunRaceEntry,
  FunSocialStatsPayload,
  FunSprintEntry,
  FunStatsPayload,
  MarketEntry,
  RadarEntry,
  RaceSkinEntry,
  ScoreStreamPayload,
  TeamRankingEntry,
  TeamWeatherEntry,
  TourEntry,
  UserScoreEntry,
} from '../models/scanEvent';
import { getBacDetails } from './beerBu.service';

interface UserWindowRow extends RowDataPacket {
  userId: number;
  firstName: string;
  lastName: string;
  teamName: string | null;
  liters: number;
  litersPerHour: number;
  drinks: number;
  lastDrinkAt: string | null;
}

interface TeamWindowRow extends RowDataPacket {
  teamId: number;
  teamName: string;
  liters: number;
  previousLiters: number;
}

interface UserAggregateRow extends RowDataPacket {
  userId: number;
  firstName: string;
  lastName: string;
  teamId: number | null;
  teamName: string | null;
  litersTotal: number;
  drinksTotal: number;
  lastDrinkAt: string | null;
  activeDays: number;
  typeVariety: number;
  favoriteBeerType: string | null;
  favoriteBeerBrand: string | null;
}

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  inFlight?: Promise<T>;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number.parseFloat(value);
  }
  return 0;
}

function compareNullableDates(a: string | null, b: string | null): number {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return bTime - aTime;
}

export class StatsService {
  private static cache = new Map<string, CacheEntry<unknown>>();

  static async getFunStats(): Promise<FunStatsPayload> {
    return StatsService.withCache('fun:legacy', 15_000, async () => {
      const live = await StatsService.getFunLiveStats();
      const bestSprints = await StatsService.getBestSprints(live.windows.shortMinutes);
      const biggestTanks = await StatsService.getBiggestTanks();

      return {
        generatedAt: live.generatedAt,
        liveWindowMinutes: live.windows.liveMinutes,
        sprintWindowMinutes: live.windows.shortMinutes,
        liveRace: live.liveRace,
        bestSprints,
        biggestTanks,
      };
    });
  }

  static async getFunLiveStats(): Promise<FunLiveStatsPayload> {
    return StatsService.withCache('fun:live', 10_000, async () => {
      const windows = {
        shortMinutes: 30,
        liveMinutes: 60,
        marketMinutes: 90,
      };

      const [liveRace, shortRace, previousShortRace, teamWeatherRows] = await Promise.all([
        StatsService.getLiveRace(windows.liveMinutes),
        StatsService.getLiveRace(windows.shortMinutes),
        StatsService.getPreviousWindowRace(windows.shortMinutes),
        StatsService.getTeamWeatherRows(windows.shortMinutes),
      ]);

      return {
        generatedAt: new Date().toISOString(),
        windows,
        liveRace,
        teamWeather: StatsService.mapTeamWeather(teamWeatherRows),
        marketBoard: StatsService.mapMarketBoard(shortRace, previousShortRace),
        radarBoard: StatsService.mapRadarBoard(liveRace),
        horseRace: StatsService.mapHorseRace(liveRace),
        tourBoard: StatsService.mapTourBoard(liveRace, shortRace),
      };
    });
  }

  static async getFunMedicalStats(userId?: number): Promise<FunMedicalStatsPayload> {
    const cacheKey = typeof userId === 'number' ? `fun:medical:${userId}` : 'fun:medical:default';
    return StatsService.withCache(cacheKey, 30_000, async () => {
      const aggregates = await StatsService.getUserAggregates();
      const sorted = aggregates
        .filter((entry) => entry.drinksTotal > 0)
        .sort((a, b) => compareNullableDates(a.lastDrinkAt, b.lastDrinkAt))
        .slice(0, 12);

      const candidateIds = new Set<number>();
      for (const entry of sorted) {
        candidateIds.add(entry.userId);
      }
      if (typeof userId === 'number' && Number.isInteger(userId) && userId > 0) {
        candidateIds.add(userId);
      }

      const bacRows = await Promise.all(
        Array.from(candidateIds).map(async (candidateId) => {
          try {
            const details = await getBacDetails(candidateId);
            const aggregate = aggregates.find((entry) => entry.userId === candidateId) ?? null;
            return StatsService.mapMedicalEntry(details, aggregate?.teamName ?? null);
          } catch {
            return null;
          }
        })
      );

      const spotlightUsers = bacRows
        .filter((entry): entry is FunMedicalUserEntry => Boolean(entry))
        .sort((a, b) => {
          if (b.currentBac !== a.currentBac) {
            return b.currentBac - a.currentBac;
          }
          return compareNullableDates(a.lastDrinkAt, b.lastDrinkAt);
        });

      if (typeof userId === 'number') {
        const forcedIndex = spotlightUsers.findIndex((entry) => entry.userId === userId);
        if (forcedIndex > 0) {
          const [forced] = spotlightUsers.splice(forcedIndex, 1);
          spotlightUsers.unshift(forced);
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        spotlightUsers: spotlightUsers.slice(0, 6),
      };
    });
  }

  static async getFunSocialStats(): Promise<FunSocialStatsPayload> {
    return StatsService.withCache('fun:social', 60_000, async () => {
      const aggregates = (await StatsService.getUserAggregates())
        .filter((entry) => entry.drinksTotal > 0)
        .sort((a, b) => {
          if (b.litersTotal !== a.litersTotal) {
            return b.litersTotal - a.litersTotal;
          }
          return b.drinksTotal - a.drinksTotal;
        })
        .slice(0, 8);

      return {
        generatedAt: new Date().toISOString(),
        profiles: aggregates.map((entry) => StatsService.mapProfileEntry(entry)),
        datingCards: aggregates.map((entry) => StatsService.mapDatingEntry(entry)),
      };
    });
  }

  static async getPointsByEquipeId(
    equipeId: number,
    from?: string,
    to?: string,
    brand?: string,
    type?: string
  ): Promise<number> {
    let whereClauses = 'WHERE u.team_id = ?';
    const params: any[] = [equipeId];

    if (from) {
      whereClauses += ` AND bu.drank_at >= ?`;
      params.push(from);
    }
    if (to) {
      whereClauses += ` AND bu.drank_at <= ?`;
      params.push(to);
    }
    if (brand) {
      whereClauses += ` AND br.brand = ?`;
      params.push(brand);
    }
    if (type) {
      whereClauses += ` AND br.type = ?`;
      params.push(type);
    }

    const sql = `
      SELECT SUM(score) AS totalPoints FROM (
        SELECT bu.score AS score
        FROM beer_bu bu
        JOIN users     u  ON bu.user_id     = u.id
        JOIN rfid_tags rt ON bu.rfid_tag_id = rt.id
        JOIN beers     br ON rt.beer_id     = br.id
        ${whereClauses}

        UNION ALL

        SELECT mb.points AS score
        FROM manual_bonus mb
        WHERE mb.team_id = ?
      ) AS combined_scores;
    `;

    params.push(equipeId);

    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    const total = rows[0]?.totalPoints;
    return total ?? 0;
  }

  static async getPointsParUtilisateur(
    equipeId?: number,
    from?: string,
    to?: string,
    brand?: string,
    type?: string
  ): Promise<UserScoreEntry[]> {
    let sql = `
      SELECT
        u.id           AS utilisateurId,
        u.first_name   AS firstName,
        SUM(bu.score)  AS points
      FROM beer_bu bu
      JOIN users u      ON bu.user_id = u.id
      JOIN rfid_tags rt ON bu.rfid_tag_id = rt.id
      JOIN beers     br ON rt.beer_id    = br.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (equipeId !== undefined) {
      sql += ` AND u.team_id = ?`;
      params.push(equipeId);
    }
    if (from) {
      sql += ` AND bu.drank_at >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND bu.drank_at <= ?`;
      params.push(to);
    }
    if (brand) {
      sql += ` AND br.brand = ?`;
      params.push(brand);
    }
    if (type) {
      sql += ` AND br.type = ?`;
      params.push(type);
    }

    sql += `
      GROUP BY u.id
      ORDER BY points DESC
    `;

    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    return rows as UserScoreEntry[];
  }

  static async getAllTeamScores(): Promise<TeamRankingEntry[]> {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        t.id AS teamId,
        t.name AS teamName,
        (
          IFNULL(SUM(bu.score), 0) +
          IFNULL((
            SELECT SUM(points) FROM manual_bonus mb WHERE mb.team_id = t.id
          ), 0)
        ) AS points
      FROM teams t
      LEFT JOIN users u ON u.team_id = t.id
      LEFT JOIN beer_bu bu ON bu.user_id = u.id
      GROUP BY t.id
      ORDER BY points DESC
    `);

    return rows.map((row) => ({
      teamId: row.teamId as number,
      teamName: row.teamName as string,
      points: row.points as number,
    }));
  }

  static async getTeamIdForUser(userId: number): Promise<number | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT team_id AS teamId
         FROM users
        WHERE id = ?
        LIMIT 1`,
      [userId]
    );

    const teamId = rows[0]?.teamId;
    return typeof teamId === 'number' ? teamId : null;
  }

  static async getScoreStreamPayload(scanId: string, userId: number): Promise<ScoreStreamPayload> {
    const ranking = await StatsService.getAllTeamScores();
    const teamId = await StatsService.getTeamIdForUser(userId);
    const team = ranking.find((entry) => entry.teamId === teamId) ?? null;
    const best = ranking[0] ?? null;
    const userScores = teamId !== null ? await StatsService.getPointsParUtilisateur(teamId) : [];
    const bestTeamUsers = best ? await StatsService.getPointsParUtilisateur(best.teamId) : [];

    return {
      eventId: randomUUID(),
      scanId,
      committedAt: new Date().toISOString(),
      ranking,
      teamId: team?.teamId ?? null,
      teamName: team?.teamName ?? null,
      teamPoints: team?.points ?? null,
      userScores,
      bestTeamId: best?.teamId ?? null,
      bestTeamName: best?.teamName ?? null,
      bestTeamPoints: best?.points ?? null,
      bestTeamUsers,
    };
  }

  private static async getLiveRace(windowMinutes: number): Promise<FunRaceEntry[]> {
    const [rows] = await db.query<UserWindowRow[]>(
      `
        SELECT
          u.id AS userId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          t.name AS teamName,
          ROUND(SUM(beers.volume_ml) / 1000, 2) AS liters,
          ROUND((SUM(beers.volume_ml) / 1000) * (60 / ?), 2) AS litersPerHour,
          COUNT(*) AS drinks,
          MAX(bbu.drank_at) AS lastDrinkAt
        FROM beer_bu bbu
        JOIN users u ON u.id = bbu.user_id
        LEFT JOIN teams t ON t.id = u.team_id
        JOIN rfid_tags rt ON rt.id = bbu.rfid_tag_id
        JOIN beers ON beers.id = rt.beer_id
        WHERE bbu.drank_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        GROUP BY u.id, u.first_name, u.last_name, t.name
        HAVING liters > 0
        ORDER BY litersPerHour DESC, liters DESC, drinks DESC, firstName ASC
        LIMIT 8
      `,
      [windowMinutes, windowMinutes]
    );

    return rows.map((row) => ({
      userId: Number(row.userId),
      firstName: String(row.firstName),
      lastName: String(row.lastName),
      teamName: row.teamName ? String(row.teamName) : null,
      liters: toNumber(row.liters),
      litersPerHour: toNumber(row.litersPerHour),
      drinks: Number(row.drinks),
      lastDrinkAt: toIso(row.lastDrinkAt),
    }));
  }

  private static async getPreviousWindowRace(windowMinutes: number): Promise<FunRaceEntry[]> {
    const [rows] = await db.query<UserWindowRow[]>(
      `
        SELECT
          u.id AS userId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          t.name AS teamName,
          ROUND(SUM(beers.volume_ml) / 1000, 2) AS liters,
          ROUND((SUM(beers.volume_ml) / 1000) * (60 / ?), 2) AS litersPerHour,
          COUNT(*) AS drinks,
          MAX(bbu.drank_at) AS lastDrinkAt
        FROM beer_bu bbu
        JOIN users u ON u.id = bbu.user_id
        LEFT JOIN teams t ON t.id = u.team_id
        JOIN rfid_tags rt ON rt.id = bbu.rfid_tag_id
        JOIN beers ON beers.id = rt.beer_id
        WHERE bbu.drank_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
          AND bbu.drank_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        GROUP BY u.id, u.first_name, u.last_name, t.name
        HAVING liters > 0
        ORDER BY litersPerHour DESC, liters DESC, drinks DESC, firstName ASC
      `,
      [windowMinutes, windowMinutes * 2, windowMinutes]
    );

    return rows.map((row) => ({
      userId: Number(row.userId),
      firstName: String(row.firstName),
      lastName: String(row.lastName),
      teamName: row.teamName ? String(row.teamName) : null,
      liters: toNumber(row.liters),
      litersPerHour: toNumber(row.litersPerHour),
      drinks: Number(row.drinks),
      lastDrinkAt: toIso(row.lastDrinkAt),
    }));
  }

  private static async getTeamWeatherRows(windowMinutes: number): Promise<TeamWindowRow[]> {
    const [rows] = await db.query<TeamWindowRow[]>(
      `
        SELECT
          t.id AS teamId,
          t.name AS teamName,
          ROUND(COALESCE(SUM(CASE
            WHEN bbu.drank_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
            THEN beers.volume_ml
            ELSE 0
          END), 0) / 1000, 2) AS liters,
          ROUND(COALESCE(SUM(CASE
            WHEN bbu.drank_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
             AND bbu.drank_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
            THEN beers.volume_ml
            ELSE 0
          END), 0) / 1000, 2) AS previousLiters
        FROM teams t
        LEFT JOIN users u ON u.team_id = t.id
        LEFT JOIN beer_bu bbu ON bbu.user_id = u.id
        LEFT JOIN rfid_tags rt ON rt.id = bbu.rfid_tag_id
        LEFT JOIN beers ON beers.id = rt.beer_id
        GROUP BY t.id, t.name
        ORDER BY liters DESC, t.name ASC
      `,
      [windowMinutes, windowMinutes * 2, windowMinutes]
    );

    return rows;
  }

  private static async getBiggestTanks(): Promise<FunRaceEntry[]> {
    const [rows] = await db.query<UserWindowRow[]>(
      `
        SELECT
          u.id AS userId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          t.name AS teamName,
          ROUND(SUM(beers.volume_ml) / 1000, 2) AS liters,
          ROUND(SUM(beers.volume_ml) / 1000, 2) AS litersPerHour,
          COUNT(*) AS drinks,
          MAX(bbu.drank_at) AS lastDrinkAt
        FROM beer_bu bbu
        JOIN users u ON u.id = bbu.user_id
        LEFT JOIN teams t ON t.id = u.team_id
        JOIN rfid_tags rt ON rt.id = bbu.rfid_tag_id
        JOIN beers ON beers.id = rt.beer_id
        GROUP BY u.id, u.first_name, u.last_name, t.name
        HAVING liters > 0
        ORDER BY liters DESC, drinks DESC, firstName ASC
        LIMIT 8
      `
    );

    return rows.map((row) => ({
      userId: Number(row.userId),
      firstName: String(row.firstName),
      lastName: String(row.lastName),
      teamName: row.teamName ? String(row.teamName) : null,
      liters: toNumber(row.liters),
      litersPerHour: toNumber(row.litersPerHour),
      drinks: Number(row.drinks),
      lastDrinkAt: toIso(row.lastDrinkAt),
    }));
  }

  private static async getBestSprints(windowMinutes: number): Promise<FunSprintEntry[]> {
    interface SprintDrinkRow extends RowDataPacket {
      userId: number;
      firstName: string;
      lastName: string;
      teamName: string | null;
      drankAt: string;
      volumeMl: number;
    }

    const [rows] = await db.query<SprintDrinkRow[]>(
      `
        SELECT
          u.id AS userId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          t.name AS teamName,
          bbu.drank_at AS drankAt,
          beers.volume_ml AS volumeMl
        FROM beer_bu bbu
        JOIN users u ON u.id = bbu.user_id
        LEFT JOIN teams t ON t.id = u.team_id
        JOIN rfid_tags rt ON rt.id = bbu.rfid_tag_id
        JOIN beers ON beers.id = rt.beer_id
        ORDER BY u.id ASC, bbu.drank_at ASC
      `
    );

    const byUser = new Map<number, SprintDrinkRow[]>();
    for (const row of rows) {
      const list = byUser.get(Number(row.userId)) ?? [];
      list.push(row);
      byUser.set(Number(row.userId), list);
    }

    const bestSprints: FunSprintEntry[] = [];
    for (const [userId, drinks] of byUser.entries()) {
      let bestLiters = 0;
      let bestStartAt: string | null = null;
      let bestEndAt: string | null = null;
      let right = 0;
      let windowVolumeMl = 0;

      for (let left = 0; left < drinks.length; left += 1) {
        const leftTs = new Date(drinks[left].drankAt).getTime();
        while (right < drinks.length) {
          const rightTs = new Date(drinks[right].drankAt).getTime();
          if (rightTs - leftTs > windowMinutes * 60 * 1000) {
            break;
          }
          windowVolumeMl += Number(drinks[right].volumeMl);
          right += 1;
        }

        const liters = Number((windowVolumeMl / 1000).toFixed(2));
        if (liters > bestLiters) {
          bestLiters = liters;
          bestStartAt = new Date(drinks[left].drankAt).toISOString();
          bestEndAt = new Date(drinks[right - 1].drankAt).toISOString();
        }

        windowVolumeMl -= Number(drinks[left].volumeMl);
      }

      if (bestLiters <= 0) {
        continue;
      }

      const sample = drinks[0];
      bestSprints.push({
        userId,
        firstName: String(sample.firstName),
        lastName: String(sample.lastName),
        teamName: sample.teamName ? String(sample.teamName) : null,
        liters: bestLiters,
        litersPerHour: Number((bestLiters * (60 / windowMinutes)).toFixed(2)),
        windowMinutes,
        startAt: bestStartAt,
        endAt: bestEndAt,
      });
    }

    return bestSprints
      .sort(
        (a, b) =>
          b.litersPerHour - a.litersPerHour ||
          b.liters - a.liters ||
          a.firstName.localeCompare(b.firstName)
      )
      .slice(0, 8);
  }

  private static async getUserAggregates(): Promise<UserAggregateRow[]> {
    const [rows] = await db.query<UserAggregateRow[]>(
      `
        SELECT
          u.id AS userId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          t.id AS teamId,
          t.name AS teamName,
          ROUND(COALESCE(SUM(beers.volume_ml), 0) / 1000, 2) AS litersTotal,
          COUNT(bbu.id) AS drinksTotal,
          MAX(bbu.drank_at) AS lastDrinkAt,
          COUNT(DISTINCT DATE(bbu.drank_at)) AS activeDays,
          COUNT(DISTINCT beers.type) AS typeVariety,
          (
            SELECT beers2.type
            FROM beer_bu b2
            JOIN rfid_tags rt2 ON rt2.id = b2.rfid_tag_id
            JOIN beers beers2 ON beers2.id = rt2.beer_id
            WHERE b2.user_id = u.id
            GROUP BY beers2.type
            ORDER BY COUNT(*) DESC, beers2.type ASC
            LIMIT 1
          ) AS favoriteBeerType,
          (
            SELECT beers3.brand
            FROM beer_bu b3
            JOIN rfid_tags rt3 ON rt3.id = b3.rfid_tag_id
            JOIN beers beers3 ON beers3.id = rt3.beer_id
            WHERE b3.user_id = u.id
            GROUP BY beers3.brand
            ORDER BY COUNT(*) DESC, beers3.brand ASC
            LIMIT 1
          ) AS favoriteBeerBrand
        FROM users u
        LEFT JOIN teams t ON t.id = u.team_id
        LEFT JOIN beer_bu bbu ON bbu.user_id = u.id
        LEFT JOIN rfid_tags rt ON rt.id = bbu.rfid_tag_id
        LEFT JOIN beers ON beers.id = rt.beer_id
        GROUP BY u.id, u.first_name, u.last_name, t.id, t.name
      `
    );

    return rows;
  }

  private static mapTeamWeather(rows: TeamWindowRow[]): TeamWeatherEntry[] {
    return rows
      .filter((row) => toNumber(row.liters) > 0 || toNumber(row.previousLiters) > 0)
      .slice(0, 8)
      .map((row) => {
        const liters = toNumber(row.liters);
        const previousLiters = toNumber(row.previousLiters);
        const intensity =
          liters >= 2
            ? 'extreme'
            : liters >= 1.2
              ? 'high'
              : liters >= 0.5
                ? 'medium'
                : 'low';

        const phenomenon =
          intensity === 'extreme'
            ? 'tempete de pintes'
            : intensity === 'high'
              ? 'alerte mousse orange'
              : intensity === 'medium'
                ? 'averses blondes'
                : 'eclaircies houblonnees';

        const trend =
          liters > previousLiters + 0.2
            ? 'front chaud'
            : previousLiters > liters + 0.2
              ? 'accalmie'
              : 'rafales stables';

        return {
          teamId: Number(row.teamId),
          teamName: String(row.teamName),
          liters,
          previousLiters,
          intensity,
          phenomenon,
          trend,
          bulletin: `${String(row.teamName)} subit ${phenomenon}, tendance ${trend}.`,
        };
      });
  }

  private static mapMarketBoard(current: FunRaceEntry[], previous: FunRaceEntry[]): MarketEntry[] {
    const previousByUser = new Map(previous.map((entry) => [entry.userId, entry]));

    return current.map((entry) => {
      const previousEntry = previousByUser.get(entry.userId);
      const previousLiters = previousEntry?.liters ?? 0;
      const base = previousLiters <= 0 ? Math.max(entry.liters, 0.1) : previousLiters;
      const variationPct = Number((((entry.liters - previousLiters) / base) * 100).toFixed(1));
      const volatility = Number(Math.abs(entry.liters - previousLiters).toFixed(2));
      const currentIndex = Number((entry.litersPerHour * 100).toFixed(1));
      const label =
        variationPct >= 30
          ? 'bull run'
          : variationPct <= -25
            ? 'krach du demi'
            : Math.abs(variationPct) <= 10
              ? 'stable'
              : 'correction mousse';

      return {
        userId: entry.userId,
        firstName: entry.firstName,
        lastName: entry.lastName,
        teamName: entry.teamName,
        currentIndex,
        litersPerHour: entry.litersPerHour,
        currentLiters: entry.liters,
        previousLiters,
        variationPct,
        volatility,
        label,
      };
    });
  }

  private static mapRadarBoard(entries: FunRaceEntry[]): RadarEntry[] {
    return entries.map((entry) => {
      const status =
        entry.litersPerHour >= 1.5
          ? 'grand exces de mousse'
          : entry.litersPerHour >= 1
            ? 'flashe'
            : entry.litersPerHour >= 0.5
              ? 'surveillance'
              : 'circulez';
      const notice =
        status === 'grand exces de mousse'
          ? 'Retrait immediat du permis de tireuse.'
          : status === 'flashe'
            ? 'Contravention de comptoir en preparation.'
            : status === 'surveillance'
              ? 'Le radar municipal garde un oeil.'
              : 'Aucune infraction mousse relevee.';

      return {
        userId: entry.userId,
        firstName: entry.firstName,
        lastName: entry.lastName,
        teamName: entry.teamName,
        litersPerHour: entry.litersPerHour,
        status,
        notice,
        lastDrinkAt: entry.lastDrinkAt,
      };
    });
  }

  private static mapHorseRace(entries: FunRaceEntry[]): RaceSkinEntry[] {
    const mounts = ['Pur-sang', 'Destrier', 'Mustang', 'Trotteur', 'Alezan', 'Etalon', 'Canasson', 'Poney turbo'];
    const leaderPace = entries[0]?.litersPerHour || 1;

    return entries.map((entry, index) => {
      const progressPct = Number(Math.max(10, Math.min(100, (entry.litersPerHour / leaderPace) * 100)).toFixed(1));
      const commentary =
        index === 0
          ? 'part au galop et avale la ligne droite'
          : index === 1
            ? 'reste dans les sabots du leader'
            : 'cherche l ouverture dans le dernier virage';

      return {
        ...entry,
        mount: mounts[index % mounts.length],
        commentary,
        progressPct,
      };
    });
  }

  private static mapTourBoard(liveRace: FunRaceEntry[], shortRace: FunRaceEntry[]): TourEntry[] {
    const shortByUser = new Map(shortRace.map((entry) => [entry.userId, entry]));
    const leader = liveRace[0]?.litersPerHour ?? 0;
    const growthSorted = [...liveRace].sort((a, b) => {
      const aShort = shortByUser.get(a.userId)?.litersPerHour ?? 0;
      const bShort = shortByUser.get(b.userId)?.litersPerHour ?? 0;
      return (bShort - b.litersPerHour) - (aShort - a.litersPerHour);
    });
    const bestClimberId = growthSorted[0]?.userId ?? null;
    const sprintWinnerId = [...shortRace].sort((a, b) => b.liters - a.liters)[0]?.userId ?? null;
    const lanternId = liveRace[liveRace.length - 1]?.userId ?? null;

    return liveRace.map((entry, index) => {
      let jersey: string | null = null;
      if (index === 0) {
        jersey = 'maillot jaune';
      } else if (entry.userId === bestClimberId) {
        jersey = 'prix du grimpeur';
      } else if (entry.userId === sprintWinnerId) {
        jersey = 'sprint intermediaire';
      } else if (entry.userId === lanternId) {
        jersey = 'lanterne rouge';
      }

      const gapLitersPerHour = Number((leader - entry.litersPerHour).toFixed(2));
      const stageNote =
        jersey === 'maillot jaune'
          ? 'controle le peloton depuis le comptoir central'
          : jersey === 'prix du grimpeur'
            ? 'grimpe les futs sans changer de braquet'
            : jersey === 'sprint intermediaire'
              ? 'claque un finish tres propre'
              : jersey === 'lanterne rouge'
                ? 'ferme la caravane avec dignite'
                : 'reste au contact sur cette etape liquide';

      return {
        ...entry,
        jersey,
        gapLitersPerHour,
        stageNote,
      };
    });
  }

  private static mapMedicalEntry(
    details: Awaited<ReturnType<typeof getBacDetails>>,
    teamName: string | null
  ): FunMedicalUserEntry {
    const currentBac = Number(details.summary.currentBac.toFixed(3));
    const controlStatus =
      currentBac >= 0.5 ? 'vehicule immobilise' : currentBac > 0 ? 'contre-visite' : 'OK';
    const controlHeadline =
      currentBac >= 0.5
        ? 'Moteur noye, passage au banc refuse.'
        : currentBac > 0
          ? 'Quelques voyants s allument, repassez plus tard.'
          : 'Controle valide, carburation propre.';
    const warningLights = [
      currentBac >= 0.5 ? 'moteur noye' : null,
      details.summary.peakBac >= 0.5 ? 'radiateur houblonne' : null,
      details.summary.totalDrinks >= 4 ? 'frein moteur absent' : null,
    ].filter((entry): entry is string => Boolean(entry));
    const healthWarnings = [
      currentBac >= 0.5 ? 'Hydratation inverse detectee.' : 'Rythme vital encore homologable.',
      details.summary.totalAlcoholGrams >= 80 ? 'Pouls de tireuse en montee.' : 'Circulation maltée sous controle.',
      details.summary.totalDrinks >= 5 ? 'Stabilite theorique discutable.' : 'Posture encore compatible avec le mobilier.',
    ];

    return {
      userId: details.user.id,
      firstName: details.user.firstname,
      lastName: details.user.lastname,
      teamName,
      currentBac,
      peakBac: Number(details.summary.peakBac.toFixed(3)),
      totalDrinks: details.summary.totalDrinks,
      totalAlcoholGrams: Number(details.summary.totalAlcoholGrams.toFixed(2)),
      lastDrinkAt: details.drinks[0]?.drankAt ?? null,
      controlStatus,
      controlHeadline,
      healthWarnings,
      engineTempLevel: Math.min(100, Math.round((currentBac / 0.8) * 100)),
      warningLights,
    };
  }

  private static mapProfileEntry(entry: UserAggregateRow): FunProfileEntry {
    const headline =
      entry.litersTotal >= 5
        ? 'Senior throughput specialist en pression haute charge'
        : entry.litersTotal >= 2
          ? 'Consultant execution comptoir et stabilite houblonnee'
          : 'Associate analyste des demi a cycle court';
    const skills = [
      entry.litersTotal >= 3 ? 'Descente endurante' : 'Demarrage propre',
      entry.typeVariety >= 3 ? 'Polyvalence de portefeuille' : 'Fidelite produit',
      entry.teamName ? 'Synergie d equipe' : 'Autonomie au comptoir',
      entry.activeDays >= 3 ? 'Regularite multi-jour' : 'Impact ponctuel',
    ];

    return {
      userId: entry.userId,
      firstName: String(entry.firstName),
      lastName: String(entry.lastName),
      teamName: entry.teamName ? String(entry.teamName) : null,
      headline,
      skills,
      endorsements: Math.max(3, Number(entry.drinksTotal) * 2 + (entry.teamName ? 5 : 0)),
      careerStats: {
        litersTotal: toNumber(entry.litersTotal),
        drinksTotal: Number(entry.drinksTotal),
        favoriteBeerType: entry.favoriteBeerType ? String(entry.favoriteBeerType) : null,
        activeDays: Number(entry.activeDays),
      },
    };
  }

  private static mapDatingEntry(entry: UserAggregateRow): FunDatingEntry {
    const favoriteBeerType = entry.favoriteBeerType ? String(entry.favoriteBeerType) : null;
    const favoriteBeerBrand = entry.favoriteBeerBrand ? String(entry.favoriteBeerBrand) : null;
    const matchScore = Math.min(
      99,
      52 +
        Math.round(toNumber(entry.litersTotal) * 6) +
        Number(entry.typeVariety) * 4 +
        (entry.teamName ? 5 : 0)
    );
    const lookingFor =
      favoriteBeerType
        ? `Relation semi-serieuse avec ${favoriteBeerType.toLowerCase()} bien tenue`
        : 'Rencontre stable avec pression fraiche';
    const bio =
      favoriteBeerBrand
        ? `Profil attire par ${favoriteBeerBrand}, adore les plans simples et les fins de service bien executees.`
        : 'Ouvert aux belles pressions, prefere les rendez-vous frais et bien tires.';
    const greenFlags = [
      entry.teamName ? 'Sait partager une table sans conflit de mousse' : 'Autonome sur les petits formats',
      entry.typeVariety >= 3 ? 'Curieux sans etre instable' : 'Loyal a ses classiques',
      entry.activeDays >= 2 ? 'Revient quand il dit quil revient' : 'Ne ghoste pas le comptoir trop longtemps',
    ];

    return {
      userId: entry.userId,
      firstName: String(entry.firstName),
      teamName: entry.teamName ? String(entry.teamName) : null,
      favoriteBeerType,
      favoriteBeerBrand,
      matchScore,
      lookingFor,
      bio,
      greenFlags,
    };
  }

  private static async withCache<T>(
    key: string,
    ttlMs: number,
    producer: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const existing = StatsService.cache.get(key) as CacheEntry<T> | undefined;
    if (existing?.value !== undefined && existing.expiresAt > now) {
      return existing.value;
    }

    if (existing?.inFlight) {
      return existing.inFlight;
    }

    const inFlight = producer()
      .then((value) => {
        StatsService.cache.set(key, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
        return value;
      })
      .catch((error) => {
        StatsService.cache.delete(key);
        throw error;
      });

    StatsService.cache.set(key, {
      expiresAt: now + ttlMs,
      inFlight,
    });

    return inFlight;
  }
}
