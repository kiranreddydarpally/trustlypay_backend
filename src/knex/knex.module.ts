// src/database/knex.module.ts
import { Global, Module } from '@nestjs/common';
import { knexProvider } from './knex.provider';

@Global()
@Module({
  providers: [knexProvider],
  exports: [knexProvider],
})
export class KnexModule {}
