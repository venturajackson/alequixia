export class Scheduler {
  constructor({ events, rules, agent }) {
    this.events = events;
    this.rules = rules;
    this.agent = agent;
    this.timers = [];
  }

  start() {
    const minutes = Number(this.rules.heartbeatMinutes || 30);
    const timer = setInterval(() => {
      this.events.publish({ type: "heartbeat", message: "Verificacao periodica executada." });
    }, minutes * 60 * 1000);
    this.timers.push(timer);
  }

  stop() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }
}
