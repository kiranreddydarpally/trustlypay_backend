import { Knex, knex } from 'knex';
import * as dotenv from 'dotenv';
dotenv.config();

export const KNEX_CONNECTION = 'KNEX_CONNECTION';

export const knexProvider = {
  provide: KNEX_CONNECTION,
  useFactory: async (): Promise<Knex> => {
    const config: Knex.Config = {
      client: process.env.DB_CLIENT,
      connection: process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
          }
        : {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            port: Number(process.env.DB_PORT),
            ssl: { rejectUnauthorized: false },
          },
    };
    return knex(config);
  },
};
