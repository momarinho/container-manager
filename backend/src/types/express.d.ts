declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; [k: string]: any };
    }
  }
}

export {};
