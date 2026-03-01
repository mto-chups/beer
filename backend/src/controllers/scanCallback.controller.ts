import { Request, Response } from 'express';

// On garde en mémoire tous les clients SSE connectés
const clients: Response[] = [];

/**
 * Abonne un client à l’EventStream.
 */
export function initScanCallback(req: Request, res: Response) {
  // En-têtes obligatoires SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Si besoin, autoriser CORS ici ou l’avoir globalement
    'Access-Control-Allow-Origin': '*',
  });

  // Kickstart
  res.write('\n');

  // Ajoute à la liste
  clients.push(res);

  // Quand le client se déconnecte, on le retire
  req.on('close', () => {
    const idx = clients.indexOf(res);
    if (idx !== -1) clients.splice(idx, 1);
  });
}

/**
 * Reçoit le POST du script Python et le retransmet à tous les
 * clients SSE sous forme d’un « data: …\n\n ».
 */
export function sendScanCallback(req: Request, res: Response) {
  const payload = req.body;
  const s = JSON.stringify(payload);

  // envoie à tous les clients SSE
  clients.forEach((client) => {
    client.write(`data: ${s}\n\n`);
  });

  // On répond HTTP 204 (pas de contenu)
  res.status(204).end();
}
