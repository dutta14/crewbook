import { BriefingCelebrations } from '../components/BriefingCelebrations';
import { BriefingEmptyState } from '../components/BriefingEmptyState';
import { BriefingOnLeave } from '../components/BriefingOnLeave';
import { BriefingTodos } from '../components/BriefingTodos';
import { BriefingWhosOut } from '../components/BriefingWhosOut';
import { DashboardReminders } from '../components/DashboardReminders';
import { GapAlertCard } from '../components/GapAlert';
import { MessageSquareIcon } from '../components/icons';
import { TodaysOneOnes } from '../components/TodaysOneOnes';
import { useBriefingData } from '../hooks/useBriefingData';
import { useFeedbackQuickAdd } from '../hooks/useFeedbackQuickAdd';
import '../styles/button.css';
import '../styles/dashboard.css';

interface DashboardProps {
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

const LOAD_FAILED = "Couldn't open your briefing. Lock and unlock Crewbook to try again.";

/**
 * The morning briefing. Everything on it is derived from decrypted in-memory data on render, and
 * none of it reaches the page title or the URL.
 */
export function Dashboard({ now }: DashboardProps) {
  const briefing = useBriefingData(now);
  const { openQuickAdd, quickAddModal } = useFeedbackQuickAdd();
  const { sections, members, actions } = briefing;

  return (
    <div role="region" aria-label="Daily briefing" className="dashboard">
      <div className="dashboard__greeting">
        <div>
          <h1 className="dashboard__title">{briefing.greeting}</h1>
          <p className="dashboard__date">
            <time dateTime={briefing.isoDate}>{briefing.formattedDate}</time>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary dashboard__feedback"
          onClick={() => void openQuickAdd()}
        >
          <MessageSquareIcon size={16} />
          Log feedback
        </button>
      </div>
      {quickAddModal}
      {briefing.loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : !briefing.isReady ? (
        <p className="todays-card__status">Opening your briefing…</p>
      ) : briefing.isEmpty ? (
        <BriefingEmptyState nextMeetingInfo={briefing.nextMeetingInfo} />
      ) : (
        <div role="region" aria-label="Briefing sections" className="dashboard__grid">
          <h2 className="sr-only">Today</h2>
          <TodaysOneOnes meetings={sections.todaysMeetings} members={members} index={0} />
          <GapAlertCard alerts={sections.overdueMeetings} members={members} index={1} />
          <BriefingTodos todos={sections.dueTodos} onToggle={actions.toggleTodo} index={2} />
          <DashboardReminders
            reminders={sections.dueReminders}
            importantDates={sections.importantDates}
            members={members}
            onDismiss={actions.dismissReminder}
            onSnooze={actions.snoozeReminder}
            index={3}
            now={now}
          />
          <BriefingCelebrations celebrations={sections.celebrations} members={members} index={4} />
          <BriefingOnLeave people={sections.onLeave} members={members} index={5} />
          <BriefingWhosOut
            people={sections.whosOut}
            members={members}
            today={briefing.isoDate}
            index={6}
          />
        </div>
      )}
    </div>
  );
}
