import { describe, expect, it } from 'vitest';

import { toCommittedResponse, toRejectedResponse } from '../../src/services/scanEvent.service';
import type { ScanEvent } from '../../src/models/scanEvent';

describe('scanEvent.service', () => {
  it('builds a committed response for a new scan', () => {
    const event: ScanEvent = {
      scanId: 'scan-1',
      uid: 'ABC123',
      userId: 7,
      beerBuId: 15,
      score: 4,
      status: 'committed',
    };

    expect(toCommittedResponse(event)).toEqual({
      message: 'Biere consommee enregistree',
      status: 'committed',
      scanId: 'scan-1',
      id: 15,
      score: 4,
      userId: 7,
      duplicate: false,
    });
  });

  it('builds a duplicate committed response when the scan was already processed', () => {
    const event: ScanEvent = {
      scanId: 'scan-2',
      uid: 'DEF456',
      userId: 9,
      beerBuId: 16,
      score: 2,
      status: 'committed',
    };

    expect(toCommittedResponse(event, true)).toEqual({
      message: 'Scan deja traite',
      status: 'committed',
      scanId: 'scan-2',
      id: 16,
      score: 2,
      userId: 9,
      duplicate: true,
    });
  });

  it('builds a rejected response with the service error details', () => {
    const event: ScanEvent = {
      scanId: 'scan-3',
      uid: 'GHI789',
      userId: 11,
      status: 'rejected',
      errorCode: 'no_current_user',
      errorMessage: 'Aucun utilisateur sélectionné sur la borne',
    };

    expect(toRejectedResponse(event)).toEqual({
      message: 'Aucun utilisateur sélectionné sur la borne',
      status: 'rejected_final',
      scanId: 'scan-3',
      code: 'no_current_user',
      userId: 11,
    });
  });
});
