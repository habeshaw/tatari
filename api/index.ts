import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { createTatariApp } from '../src/serverApp.ts';

const app = createTatariApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as express.Request, res as express.Response);
}
