import { corsMiddleware } from './middlewares/cors-middlewares';
import { sessionMiddleware } from './middlewares/session-middleware';
import { csrfMiddleware } from './middlewares/csrf-middleware';
import honoFactory from './hono-factory';
import metadataRoute from './routes/metadata-route';
import { notFound } from './lib/api-response';
import { handleHonoError } from './lib/error-utils';
import defaultRoute from './routes/default-route';
import docRoute from './routes/doc-route';
import profileRoute from './routes/profile-route';
import handleRoute from './routes/handle-route';

const app = honoFactory
  .createApp()
  .use(corsMiddleware)
  .use(csrfMiddleware)
  .use(sessionMiddleware)
  .onError(handleHonoError)
  .notFound((c) => notFound(c, 'not_found', 'route not found'))
  .on(["POST", "GET"], "/auth/*", (c) => {
    const auth = c.get("auth");
    return auth.handler(c.req.raw);
  })
  .route('/', defaultRoute)
  .route('/metadata', metadataRoute)
  .route('/handle', handleRoute)
  .route('/profile', profileRoute)
  .route('/docs', docRoute);

export default app
