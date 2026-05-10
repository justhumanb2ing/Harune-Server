import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Context } from "hono";
import { Pool } from "pg";
import { baseSchema } from "../schemas/base";
import type { AppBindings } from "../types/app-bindings";

export type Database = NodePgDatabase<typeof baseSchema>;

export type DatabaseClient = {
	db: Database;
	close: () => Promise<void>;
};

export function createDatabaseClient(connectionString: string): DatabaseClient {
	const pool = new Pool({
		connectionString,
		max: 1,
		connectionTimeoutMillis: 5_000,
	});

	const db = drizzle({ client: pool, schema: baseSchema });

	return {
		db,
		close: async () => pool.end(),
	};
}

export function createDB(c: Context<AppBindings>): Database {
	const cachedDB = c.get("db") as Database | undefined;
	if (cachedDB) {
		return cachedDB;
	}

	const client = createDatabaseClient(c.env.HYPERDRIVE.connectionString);
	c.set("db", client.db);

	return client.db;
}
