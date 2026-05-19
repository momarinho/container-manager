type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export const authEventsService = {
  emitUnauthorized(): void {
    unauthorizedListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("Error while handling unauthorized event:", error);
      }
    });
  },

  subscribeUnauthorized(listener: UnauthorizedListener): () => void {
    unauthorizedListeners.add(listener);

    return () => {
      unauthorizedListeners.delete(listener);
    };
  },
};
