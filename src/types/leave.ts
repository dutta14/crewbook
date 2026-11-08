export type LeaveType = 'pto' | 'sick' | 'personal' | 'parental';

/**
 * A stretch of time a team member is out. The type can reveal health or family details, so entries
 * live in the private envelope rather than on the member record.
 */
export interface LeaveEntry {
  id: string;
  memberId: string;
  type: LeaveType;
  /** First day out, YYYY-MM-DD. */
  startDate: string;
  /** Last day out, YYYY-MM-DD, never before the start date. */
  endDate: string;
  /** ISO 8601 */
  createdAt: string;
}
