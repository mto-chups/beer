export interface User {
    id?: number;
    firstName: string;
    lastName: string;
    phone?: string;
    teamId: number;
    team_id?: number | null;
}