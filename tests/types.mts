import { Scheduler, layoutEvents, type SchedulerProps } from '@lp-labs/react-scheduler';

const props: SchedulerProps = {
  date: new Date(),
  events: [],
  onDateChange(date) {
    date.getTime();
  },
  onEventChange(event, context) {
    event.end.getTime();
    const reason: 'move' | 'resize' = context.reason;
    void reason;
  },
};
Scheduler(props);
layoutEvents(props.events, props.date);
