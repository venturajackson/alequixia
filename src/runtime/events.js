export function createEventBus() {
  const subscribers = new Set();
  const recent = [];

  return {
    publish(event) {
      const enriched = { ...event, at: new Date().toISOString() };
      recent.push(enriched);
      if (recent.length > 100) recent.shift();
      for (const subscriber of subscribers) subscriber(enriched);
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      for (const event of recent) subscriber(event);
      return () => subscribers.delete(subscriber);
    },
    recent() {
      return [...recent];
    }
  };
}
