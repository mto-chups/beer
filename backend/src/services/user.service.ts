import { db } from '../config/db';


export interface User {
  id?: number;
  firstname: string;
  lastname: string;
  phone?: string;
  weight: number;
  age: number;
  gender: 'M' | 'F'
  team_id?: number | null;
}

export const createUser = async (user: User): Promise<number> => {
  const [result] = await db.execute(
    `INSERT INTO users
      (first_name, last_name, phone, weight, age, gender)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user.firstname,
      user.lastname,
      user.phone || null,
      user.weight,
      user.age,
      user.gender
    ]
  );
  // @ts-ignore
  return (result as any).insertId;
};

export const fetchAllUsers = async (): Promise<User[]> => {
  const [rows] = await db.execute(
    `SELECT
       id,
       first_name   AS firstname,
       last_name    AS lastname,
       phone,
       weight,
       age,
       gender,
       team_id
     FROM users`
  );
  return rows as User[];
};

export const removeUser = async (id: number) => {
  await db.execute('DELETE FROM users WHERE id = ?', [id]);
};

export const setUserTeam = async (userId: number, teamId: number | null) => {
  await db.execute('UPDATE users SET team_id = ? WHERE id = ?', [teamId, userId]);
};

export const fetchAllTeams = async () => {
  const [rows] = await db.execute('SELECT id, name FROM teams');
  return rows as any[];
};

export const updateUserData = async (
  id: number,
  firstname: string,
  lastname: string,
  phone: string | null,
  weight: number,
  age: number,
  gender: 'M' | 'F'
) => {
  await db.execute(
    `UPDATE users SET
       first_name = ?,
       last_name  = ?,
       phone      = ?,
       weight     = ?,
       age        = ?,
       gender     = ?
     WHERE id = ?`,
    [firstname, lastname, phone, weight, age, gender, id]
  );
};

