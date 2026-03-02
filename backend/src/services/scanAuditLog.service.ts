import fs from 'fs';
import path from 'path';

type Serializable = string | number | boolean | null | Serializable[] | {
  [key: string]: Serializable;
};

const logsDir = path.resolve(__dirname, '../../logs');
let writeQueue: Promise<void> = Promise.resolve();

function getLogFilePath(now: Date): string {
  const date = now.toISOString().slice(0, 10);
  return path.join(logsDir, `scan-events-${date}.log`);
}

export function appendScanAuditLog(entry: Record<string, Serializable>): Promise<void> {
  const now = new Date();
  const line = `${JSON.stringify({ ts: now.toISOString(), ...entry })}\n`;

  writeQueue = writeQueue
    .then(async () => {
      await fs.promises.mkdir(logsDir, { recursive: true });
      await fs.promises.appendFile(getLogFilePath(now), line, 'utf8');
    })
    .catch((error) => {
      console.error('Echec ecriture log scan:', error);
    });

  return writeQueue;
}
