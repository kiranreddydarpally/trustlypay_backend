import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { tableNames } from 'src/common/enums/table-names.enum';
import { PayinDto } from './dto/payin.dto';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { IDecodeResponse } from './interfaces/decode-response.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

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
      .withSchema(process.env.DB_SCHEMA || 'public')

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
    const requestSaltKey = merchant.request_salt_key;
    const encryptionRequestKey = merchant.encryption_request_key;
    const requestHashKey = merchant.request_hashkey;
    const apiSecret = merchant.api_secret;
    let mainRes: IDecodeResponse;
    try {
      mainRes = JSON.parse(
        await this.decryptData(
          payinDto.encryptedData,
          encryptionRequestKey,
          requestSaltKey,
        ).then((res) => {
          console.log('res', res);
          return res;
        }),
      );
    } catch (Exception) {
      return res.json({
        statusCode: '304',
        status: 'Failed',
        Description: 'Invalid Encrypted Data',
        clientId: payinDto.clientId,
      });
    }

    const clientId = mainRes.clientId;
    const txnCurr = mainRes.txnCurr;
    const amount = Number(mainRes.amount);
    const emailId = mainRes.emailId;
    const signature = mainRes.signature;
    const mobileNumber = mainRes.mobileNumber;
    const clientSecret = mainRes.clientSecret;
    const username = mainRes.username;
    const udf1 = mainRes.udf1;
    const udf2 = mainRes.udf2;
    let encodeSignature = '';

    encodeSignature = crypto
      .createHmac('sha256', requestHashKey)
      .update(
        clientId +
          clientSecret +
          txnCurr +
          amount +
          emailId +
          mobileNumber +
          username,
      )
      .digest('hex');

    if (encodeSignature === signature) {
      const orderResponce = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_order)
        .where({
          order_gid: null,
        })
        .first();

      const merchantServ = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.merchant)
        .where({ id: createdMerchant })
        .first();
      console.log('orderResponce', orderResponce);
      console.log('merchantServ', merchantServ);

      // if (merchantServ.getTransaction_limit() < amount) {
      //   return res.json({
      //     statusCode: '313',
      //     status: 'Failed',
      //     Description: 'Amount Value is Excess Than Ticket Limit.',
      //     clientId: payinDto.clientId,
      //   });
      // }
      //  if(cr.getOrder_gid()==null) {
      //=============== create order ==========================

      const tid = 'OID' + this.getAlphaNumericString(15);

      const liveOrder = {
        order_gid: tid,
        order_amount: amount,
        order_status: 'Created',
        created_date: dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        created_merchant: createdMerchant,
      };
      const result = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_order)
        .insert(liveOrder)
        .returning('*')
        .then((result) => result[0]);
      this.logger.log(`ecrypted Data: ${JSON.stringify(result)}`);
      const lp = {
        transaction_amount: amount,
        transaction_username: username,
        transaction_email: emailId,
        transaction_contact: mobileNumber,
        created_merchant: createdMerchant,
        transaction_status: 'pending',
        created_date: dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        order_id: result.id,
        udf1: udf1,
        udf2: udf2,
        vendor_id: 0,
        // rupayapay_tax: '0.00',
        // goods_service_tax: '0.00',
        // payment_amount: '0.00',
      };
      const li = this.saveLivePayment(lp);
      console.log('li', await li);

      return;
    }
    // } else {
    //   return res.json({
    //     statusCode: '305',
    //     status: 'Failed',
    //     Description: 'Signature Mismatch',
    //     clientId: payinDto.encryptedData,
    //   });
  }
  async getAlphaNumericString(length) {
    const AlphaNumericString =
      '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';

    let sb = '';

    for (let i = 0; i < length; i++) {
      sb += AlphaNumericString.charAt(
        AlphaNumericString.length * Math.random(),
      );
    }

    return sb.toString();
  }

  async saveLivePayment(lp): Promise<any> {
    const tid = 'TP' + this.getAlphaNumericString(15);
    const query = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_payment)
      .where({ vendor_transaction_id: tid })
      .first();

    if (!query) {
      lp.transaction_gid = tid;
      lp.created_date = dayjs()
        .tz('Asia/Kolkata')
        .format('YYYY-MM-DD HH:mm:ss');
      lp.adjustment_done = 'N';

      const result = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_payment)
        .insert(lp)
        .returning('*')
        .then((result) => result[0]);
      return result;
    } else {
      this.saveLivePayment(lp);
    }
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

    return decrypted;
  }
}
