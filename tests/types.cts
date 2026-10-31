import scheduler = require('@lp-labs/react-scheduler');

const props: scheduler.SchedulerProps = {
  date: new Date(),
  events: [],
  onDateChange(date) {
    date.getTime();
  },
};
scheduler.Scheduler(props);
scheduler.visibleDays(props.date);
