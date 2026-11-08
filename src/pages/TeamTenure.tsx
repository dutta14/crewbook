import { useEffect, useRef } from 'react';
import { TenureChart } from '../components/TenureChart';
import { TenureStat } from '../components/TenureStat';
import { useTenureData } from '../hooks/useTenureData';
import '../styles/tenure.css';

/** Manager-only: it shows who is leaving, so it sits behind the unlocked vault like every page. */
export function TeamTenure() {
  const { bars, averageTenure, sortField, setSortField, timeScale, today } = useTenureData();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="tenure-page__title">
        Team Tenure
      </h1>
      {bars.length > 0 ? (
        <div className="tenure-page__summary">
          <TenureStat months={averageTenure.months} label={averageTenure.label} />
        </div>
      ) : null}
      <TenureChart
        bars={bars}
        timeScale={timeScale}
        today={today}
        sortField={sortField}
        onSortChange={setSortField}
      />
    </>
  );
}
