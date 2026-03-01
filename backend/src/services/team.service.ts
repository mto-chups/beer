import { db } from '../config/db';
import { RowDataPacket } from 'mysql2';
import { Team } from '../models/team';

export interface TeamWithMembers {
  teamId:   number;
  teamName: string;
  members:  string[]; // liste des first_name
}
export const fetchAllTeams = async (): Promise<Team[]> => {
  const [rows] = await db.execute('SELECT id, name FROM teams');
  return rows as Team[];
};

export const createTeam = async (team: Team): Promise<number> => {
  const [result] = await db.execute(
    'INSERT INTO teams (name) VALUES (?)',
    [team.name]
  );
  // @ts-ignore
  return (result as any).insertId;
};

export const updateTeamName = async (id: number, name: string) => {
  await db.execute('UPDATE teams SET name = ? WHERE id = ?', [name, id]);
};

export const removeTeam = async (id: number) => {
  await db.execute('DELETE FROM teams WHERE id = ?', [id]);
};

export class TeamService {
  static async getAllTeamsWithMembers(): Promise<TeamWithMembers[]> {
    // ON récupère chaque équipe, puis on agrège les prénoms
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT 
        t.id           AS teamId,
        t.name         AS teamName,
        u.first_name   AS memberName
      FROM teams t
      LEFT JOIN users u 
        ON u.team_id = t.id
      ORDER BY t.id, u.first_name
    `);

    // on transforme en structure { teamId, teamName, members: [] }
    const map = new Map<number, TeamWithMembers>();
    for (const r of rows) {
      const id   = r.teamId as number;
      const name = r.teamName as string;
      const mem  = r.memberName as string | null;
      if (!map.has(id)) {
        map.set(id, { teamId: id, teamName: name, members: [] });
      }
      if (mem) {
        map.get(id)!.members.push(mem);
      }
    }
    return Array.from(map.values());
  }
}