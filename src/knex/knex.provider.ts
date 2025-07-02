import { Knex, knex } from 'knex';

export const KNEX_CONNECTION = 'KNEX_CONNECTION';

export const knexProvider = {
  provide: KNEX_CONNECTION,
  useFactory: async (): Promise<Knex> => {
    const config: Knex.Config = {
      client: 'mysql2',
      connection: {
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'trustlypay_db',
      },
    };
    return knex(config);
  },
};
