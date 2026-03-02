"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scanEvent_service_1 = require("../../src/services/scanEvent.service");
(0, vitest_1.describe)('scanEvent.service', () => {
    (0, vitest_1.it)('builds a committed response for a new scan', () => {
        const event = {
            scanId: 'scan-1',
            uid: 'ABC123',
            userId: 7,
            beerBuId: 15,
            score: 4,
            status: 'committed',
        };
        (0, vitest_1.expect)((0, scanEvent_service_1.toCommittedResponse)(event)).toEqual({
            message: 'Biere consommee enregistree',
            status: 'committed',
            scanId: 'scan-1',
            id: 15,
            score: 4,
            userId: 7,
            duplicate: false,
        });
    });
    (0, vitest_1.it)('builds a duplicate committed response when the scan was already processed', () => {
        const event = {
            scanId: 'scan-2',
            uid: 'DEF456',
            userId: 9,
            beerBuId: 16,
            score: 2,
            status: 'committed',
        };
        (0, vitest_1.expect)((0, scanEvent_service_1.toCommittedResponse)(event, true)).toEqual({
            message: 'Scan deja traite',
            status: 'committed',
            scanId: 'scan-2',
            id: 16,
            score: 2,
            userId: 9,
            duplicate: true,
        });
    });
    (0, vitest_1.it)('builds a rejected response with the service error details', () => {
        const event = {
            scanId: 'scan-3',
            uid: 'GHI789',
            userId: 11,
            status: 'rejected',
            errorCode: 'no_current_user',
            errorMessage: 'Aucun utilisateur sélectionné sur la borne',
        };
        (0, vitest_1.expect)((0, scanEvent_service_1.toRejectedResponse)(event)).toEqual({
            message: 'Aucun utilisateur sélectionné sur la borne',
            status: 'rejected_final',
            scanId: 'scan-3',
            code: 'no_current_user',
            userId: 11,
        });
    });
});
