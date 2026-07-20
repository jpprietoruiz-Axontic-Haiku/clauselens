import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
