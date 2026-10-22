import type { IncomingMessage, ServerResponse } from 'http';
import handler from '../stream.js';

export default async function dynamicHandler(
    req: IncomingMessage & { query?: Record<string, string | string[]> },
    res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
    return handler(req, res);
}
