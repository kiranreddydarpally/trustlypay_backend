import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { tableNames } from 'src/common/enums/table-names.enum';
import { IUser } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly _knex: Knex,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async findAll(): Promise<any[]> {
    this.logger.log('This is a log message');
    this.logger.error('This is an error message', {
      error: 'Email already exists',
      userId: 123,
    });

    return [];
  }

  async createUser(dto: CreateUserDto): Promise<IUser> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.testingUserTable)
      .insert({
        email: dto.email,
        password: hashedPassword,
      })
      .returning('*')
      .then((result) => result[0]);

    return user;
  }

  async findByEmail(email: string): Promise<IUser | undefined> {
    const findUser = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.testingUserTable)
      .where({ email: email })
      .first();
    this.logger.log(findUser);
    return findUser;
  }
}
