export type TenureStatus = 'active' | 'on_leave' | 'new_hire' | 'departing';
export type TenureSortField = 'startDate' | 'tenureLength' | 'name';

export interface TenureBar {
  engineerId: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD: today, or the expected departure for a departing member. */
  endDate: string;
  status: TenureStatus;
  /** Whole months from the start date to `endDate`; 0 until the person has started. */
  tenureMonths: number;
  /** e.g. "2y 4m" */
  tenureLabel: string;
  /** True for a hire who has not started yet. Their bar runs from today to the start date. */
  startsInFuture: boolean;
  /** True for a departing member whose expected departure date is not on record. */
  departureUnknown: boolean;
}

export interface TenureScale {
  /** YYYY-MM-DD: 1 January of the first year shown. */
  minDate: string;
  /** YYYY-MM-DD: 1 January of the year after the last one shown. */
  maxDate: string;
  years: number[];
}
