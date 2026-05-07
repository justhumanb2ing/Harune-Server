import { Hono } from 'hono';
import { fetchMetadata } from "../services/fetch-metadata";
import type { AppBindings } from '../types/app-bindings';
import {
  metadataUrlValidationErrorResponse,
  missingUrl,
} from '../lib/metadata/response';
import { parseInputUrl } from '../lib/metadata/url';

const metadataRoute = new Hono<AppBindings>()
  .get('/', async (c) => {
    const url = c.req.query('url')

    if (!url || !url.trim()) {
      return missingUrl(c)
    }

    try {
      parseInputUrl(url)
    } catch (error) {
      const response = metadataUrlValidationErrorResponse(c, error)
      if (response) {
        return response
      }
      throw error
    }

    return c.json(await fetchMetadata(url, c))
  })

export default metadataRoute;
export type AppType = typeof metadataRoute;
