// services/stats.service.ts
import { db } from '../config/db'; // Connexion MySQL
import { RowDataPacket } from 'mysql2';

export class StatsService {
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

    params.push(equipeId); // pour manual_bonus

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
  ): Promise<RowDataPacket[]> {
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
      sql   += ` AND u.team_id = ?`;
      params.push(equipeId);
    }
    if (from) {
      sql   += ` AND bu.drank_at >= ?`;
      params.push(from);
    }
    if (to) {
      sql   += ` AND bu.drank_at <= ?`;
      params.push(to);
    }
    if (brand) {
      sql   += ` AND br.brand = ?`;
      params.push(brand);
    }
    if (type) {
      sql   += ` AND br.type = ?`;
      params.push(type);
    }

    sql += `
      GROUP BY u.id
      ORDER BY points DESC
    `;

    console.log({ sql: sql.trim(), params });
    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    return rows;
  }

  // services/stats.service.ts
  static async getAllTeamScores(): Promise<{ teamId: number; teamName: string; points: number }[]> {
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

    return rows.map(r => ({
      teamId:  r.teamId as number,
      teamName: r.teamName as string,
      points:   r.points as number
    }));
  }

}

