export type FlightRiskLevel = 'none' | 'low' | 'medium' | 'high';

/**
 * One private observation about a person. Notes are append-only, so there is no `updatedAt`.
 * This is the most sensitive data in the app: it lives only in the private envelope and must
 * never be added to a shared view, an export or a summary (see src/data/privateStore.ts).
 */
export interface PrivateNote {
  /** crypto.randomUUID() */
  id: string;
  engineerId: string;
  text: string;
  flightRisk: FlightRiskLevel;
  /** ISO 8601 */
  createdAt: string;
}
