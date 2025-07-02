import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';

@Injectable()
export class UsersService {
  constructor(@Inject(KNEX_CONNECTION) private readonly _knex: Knex) {}

  async findAll(): Promise<any[]> {
    const users = await this._knex('Nest_User').where({
      username: 'ashok',
    });

    console.log(users);
    return users;
  }
}
