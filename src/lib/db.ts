import { Context } from "hono";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "../schemas/base";
import { AppBindings } from "../types/types";

export type Database = NodePgDatabase<typeof schema>;

export function createDB(c: Context<AppBindings>): Database {
  const cachedDB = c.get("db") as Database | undefined;
  if (cachedDB) {
    return cachedDB;
  }

  const pool = new Pool({
    connectionString: c.env.HYPERDRIVE.connectionString,
    max: 1,
  });

  const dbInstance = drizzle({ client: pool, schema });
  c.set("dbPool", pool);
  c.set("db", dbInstance);

  return dbInstance;
}
