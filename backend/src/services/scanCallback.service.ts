import { EventEmitter } from 'events'

// on expose un singleton pour pouvoir l’importer partout
export const scanEmitter = new EventEmitter()

export interface ScanPayload {
  uid: string
  success: boolean
  message: string
}

/**
 * Enregistre un nouvel événement de scan et le rebroadcast
 */
export function registerScan(payload: ScanPayload) {
  // tu peux ici logger en base si besoin
  scanEmitter.emit('scan', payload)
}
