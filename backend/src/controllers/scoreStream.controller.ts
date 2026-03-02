import { Request, Response } from 'express';
import { initScoreStream, removeScoreStreamClient } from '../services/scoreStream.service';

export function streamScores(_req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  initScoreStream(res);
}

export function attachScoreStreamCloseHandler(req: Request, res: Response): void {
  req.on('close', () => {
    removeScoreStreamClient(res);
  });
}
