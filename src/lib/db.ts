import { Context } from "hono";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { baseSchema } from "../schemas/base";
import { AppBindings } from "../types/app-bindings";

export type Database = NodePgDatabase<typeof baseSchema>;

export function createDB(c: Context<AppBindings>): Database {
  const cachedDB = c.get("db") as Database | undefined;
  if (cachedDB) {
    return cachedDB;
  }

  const connectionString = c.env.HYPERDRIVE.connectionString;
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  const dbInstance = drizzle({ client: pool, schema: baseSchema });
  c.set("db", dbInstance);

  return dbInstance;
}
