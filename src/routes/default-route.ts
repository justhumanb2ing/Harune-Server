import { Hono } from "hono";

const defaultRoute = new Hono()
  .get('/', (c) => {
      return c.json({
        message: 'Hello, Harune!'
      })
    })
  .get('/health', (c) => {
      return c.json({
        status: 'ok'
      })
    });

export default defaultRoute;
export type AppType = typeof defaultRoute;
