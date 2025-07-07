import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { tableNames } from 'src/common/enums/table-names.enum';
import { PayinDto } from './dto/payin.dto';
import * as crypto from 'crypto';
import { Request, Response } from 'express';

@Injectable()
export class PayinService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly salt = 'y7u7i8i9o0y7y6y7'; // 16+ chars
  private readonly ivLength = 16;
  private readonly request_key = 'MySecretPassword';

  constructor(
    @Inject(KNEX_CONNECTION) private readonly _knex: Knex,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async payIn(payinDto: PayinDto, req: Request, res: Response): Promise<any> {
    this.logger.log(payinDto, '===Post Request From Merchant {}');
    this.logger.log(req.socket.localPort, 'socket.localPort');
    this.logger.log(req.protocol, 'protocol');
    this.logger.log(req.hostname + 'hostname');

    if (!payinDto.clientId || payinDto.clientId === '') {
      return res.json({
        statusCode: '301',
        status: 'Failed',
        Description: 'Client ID is Required.',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      });
    }

    if (!payinDto.encryptedData || payinDto.encryptedData === '') {
      return res.json({
        statusCode: '302',
        status: 'Failed',
        Description: 'encryptedData is Required.',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      });
    }
    const merchant: {
      id: number;
      api_key: string;
      api_secret: string;
      api_expiry: Date;
      request_hashkey: string;
      request_salt_key: string;
      response_salt_key: string;
      encryption_request_key: string;
      encryption_response_key: string;
      response_hashkey: string;
      created_date: Date;
      created_merchant: number;
    } = await this._knex
      .withSchema('trustlypay_db')

      .table(tableNames.live_merchantapi)

      .where({ api_key: payinDto.clientId })
      .first();
    if (!merchant) {
      return res.json({
        statusCode: '303',
        status: 'Failed',
        Description: 'Invalid Client Id',
        clientId: payinDto.clientId,
      });
    }

    const createdMerchant = merchant.created_merchant;
    const requestSaltKey = 'merchant.request_salt_key';
    const encryptionRequestKey = merchant.encryption_request_key;
    const requestHashKey = merchant.request_hashkey;
    const apiSecret = merchant.api_secret;
    let result = {};
    try {
      result = this.decryptData(
        payinDto.encryptedData,
        encryptionRequestKey,
        requestSaltKey,
      );
    } catch (Exception) {
      return res.json({
        statusCode: '304',
        status: 'Failed',
        Description: 'Invalid Encrypted Data',
        clientId: payinDto.clientId,
      });
    }

    this.logger.log(`ecrypted Data: ${await result}`);
    // console.log('data', JSON.parse(await result));

    return res.json({});
  }

  async decryptData(
    encryptedHex: string,
    aesKey: string,
    salt: string,
  ): Promise<string> {
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
    const saltBuffer = Buffer.from(salt, 'utf-8');

    // Use the fixed IV from Java
    const ivBuffer = Buffer.from([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    // this.logger.log(encryptedBuffer, 'encryptedBuffer');
    // this.logger.log(saltBuffer, 'saltBuffer');
    // this.logger.log(ivBuffer, 'ivBuffer');
    // Derive key using PBKDF2 with HMAC-SHA1, 65536 iterations, 256-bit key
    const derivedKey = crypto.pbkdf2Sync(aesKey, saltBuffer, 65536, 32, 'sha1');
    // this.logger.log(derivedKey, 'derivedKey');

    // Create AES decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      derivedKey,
      ivBuffer,
    );
    // this.logger.log(decipher, 'decipher');

    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');

    // this.logger.log(decrypted, 'decrypted');
    decrypted += decipher.final('utf8');
    // this.logger.log(decrypted, 'decrypted123');

    return decrypted;
  }
}
