import { Response } from 'express';
import { randomUUID } from 'crypto';
import { ScoreStreamPayload } from '../models/scanEvent';

const clients = new Set<Response>();
let heartbeatStarted = false;

function writeEvent(res: Response, event: string, data: unknown, eventId?: string): void {
  if (eventId) {
    res.write(`id: ${eventId}\n`);
  }
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function startHeartbeat(): void {
  if (heartbeatStarted) {
    return;
  }

  heartbeatStarted = true;
  setInterval(() => {
    const payload = { ts: new Date().toISOString() };
    for (const client of [...clients]) {
      try {
        writeEvent(client, 'heartbeat', payload);
      } catch (_error) {
        clients.delete(client);
      }
    }
  }, 15000).unref();
}

export function initScoreStream(res: Response): void {
  startHeartbeat();
  clients.add(res);
  writeEvent(res, 'heartbeat', { ts: new Date().toISOString() }, randomUUID());
}

export function removeScoreStreamClient(res: Response): void {
  clients.delete(res);
}

export function broadcastScoreUpdate(payload: ScoreStreamPayload): void {
  for (const client of [...clients]) {
    try {
      writeEvent(client, 'score-update', payload, payload.eventId);
      writeEvent(
        client,
        'team-ranking-update',
        { eventId: payload.eventId, ranking: payload.ranking, committedAt: payload.committedAt },
        payload.eventId
      );
      if (payload.teamId !== null) {
        writeEvent(
          client,
          'team-score-update',
          {
            eventId: payload.eventId,
            teamId: payload.teamId,
            teamName: payload.teamName,
            teamPoints: payload.teamPoints,
            userScores: payload.userScores,
            committedAt: payload.committedAt,
            ranking: payload.ranking,
          },
          payload.eventId
        );
      }
    } catch (_error) {
      clients.delete(client);
    }
  }
}
