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
import { IVendorbank } from 'src/interfaces/vendorbank.interface';
dayjs.extend(utc);
dayjs.extend(timezone);
import { HttpService } from '@nestjs/axios';
import {
  firstValueFrom,
  retryWhen,
  scan,
  delay,
  throwError,
  catchError,
} from 'rxjs';

@Injectable()
export class PayinService {
  private cachedToken = '';
  private expiryEpoch = 0;

  constructor(
    @Inject(KNEX_CONNECTION) private readonly _knex: Knex,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly httpService: HttpService,
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
    let decryptedData: IDecodeResponse;

    try {
      decryptedData = JSON.parse(
        await this.decryptData(
          payinDto.encryptedData,
          encryptionRequestKey,
          requestSaltKey,
        ),
      );
    } catch (Exception) {
      return res.json({
        statusCode: '304',
        status: 'Failed',
        Description: 'Invalid Encrypted Data',
        clientId: payinDto.clientId,
      });
    }
    this.logger.log('decryptedData', decryptedData);

    const clientId = decryptedData.clientId;
    const txnCurr = decryptedData.txnCurr;
    const amount = Number(decryptedData.amount);
    const emailId = decryptedData.emailId;
    const signature = decryptedData.signature;
    const mobileNumber = decryptedData.mobileNumber;
    const clientSecret = decryptedData.clientSecret;
    const username = decryptedData.username;
    const udf1 = decryptedData.udf1;
    const udf2 = decryptedData.udf2;
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
      const merchantTable = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.merchant)
        .where({ id: createdMerchant })
        .first();
      console.log('merchantTable', merchantTable);

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

      const liveOrderObject = {
        order_amount: amount,
        order_status: 'Created',
        created_date: dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        created_merchant: createdMerchant,
      };
      const liveOrder = await this.generatedOrderGId(liveOrderObject);

      this.logger.log('liveOrder created' + JSON.stringify(liveOrder));
      const livePaymentObject = {
        transaction_amount: amount,
        transaction_username: username,
        transaction_email: emailId,
        transaction_contact: mobileNumber,
        created_merchant: createdMerchant,
        transaction_status: 'pending',
        created_date: dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        order_id: liveOrder.id,
        udf1: udf1,
        udf2: udf2,
        vendor_id: 0,
      };
      const livePayment = await this.saveLivePayment(livePaymentObject);
      this.logger.log(
        'Created live Transaction Id ' + livePayment.transaction_gid,
      );
      const merchantvendorbank = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.merchant_vendor_bank)
        .where({ merchant_id: createdMerchant })
        .first();
      this.logger.log('merchantvendorbank' + merchantvendorbank);

      const vendorbank: IVendorbank = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.vendor_bank)
        .where({ id: merchantvendorbank.upi })
        .first();
      this.logger.log('vendorbank ', vendorbank);

      if (vendorbank.id > 0 && vendorbank.bank_name === 'Apexio') {
        const APEX_API_URL = 'https://api.apexio.co.in/transaction/initiate';
        // 1. Prepare timestamp in ISO8601
        const apxTimestamp = dayjs()
          .tz('Asia/Kolkata')
          .format('YYYY-MM-DDTHH:mm:ssZ');

        // 2. Prepare necessary values
        let truncated = Math.trunc(amount * 10) / 10;
        const amountStr = truncated.toFixed(1);
        const merchantReferenceId = livePayment.transaction_gid;
        const service = 'upi';
        const merchantSecret = '1EDCD414A0B778933AA836E2BB8DD61E'; // replace with actual secret

        // 3. Create HMAC_SHA256 Signature: amount|service|merchant_reference_id

        const signatureData =
          amountStr + '|' + service + '|' + merchantReferenceId;
        const hmac = crypto
          .createHmac('sha256', merchantSecret)
          .update(signatureData);

        const apxSignature = hmac.digest('base64');

        this.logger.log('apx-signature', apxSignature);
        // 4. Set headers
        const token = await this.generateTokenIFNotExist();

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'apx-timestamp': apxTimestamp,
          'apx-signature': apxSignature,
        };

        // 5. Build request body
        const body = {
          merchant_reference_id: merchantReferenceId,
          amount: amount,
          currency: 'INR',
          service: service,
          service_details: { upi: { channel: 'UPI_INTENT' } },
          customer_details: {
            customer_name: livePayment.transaction_username,
            customer_email: livePayment.transaction_email,
            customer_mobile: livePayment.transaction_contact,
          },
          device_details: {
            device_name: 'Android',
            device_id: 'DEVICE1234',
            device_ip: '192.111.1.1',
          },
          geo_location: {
            latitude: '20.1111',
            longitude: '20.1111',
          },
          webhook_url:
            'https://www.trustlypay.com/api/gateway/v1/apex/payin/response',
        };

        // 6. Send Request
        const maxRetries = 3;
        const delayMs = 2000;
        const response = await firstValueFrom(
          this.httpService.post(APEX_API_URL, body, { headers }).pipe(
            retryWhen((errors) =>
              errors.pipe(
                scan((retryCount, error) => {
                  const status = error?.response?.status;

                  this.logger.error(
                    `APEX call failed [${status}] - Attempt ${retryCount + 1}: ${error.message}`,
                  );

                  if (retryCount + 1 >= maxRetries || status !== 502) {
                    throw error;
                  }
                  return retryCount + 1;
                }, 0),
                delay(delayMs),
              ),
            ),
            catchError((err) => {
              this.logger.error(`Final error after retries: ${err.message}`);
              return throwError(() => err);
            }),
          ),
        );
        this.logger.log('APEX Response: ' + response.data);
      }
      return res.status(200).json({
        response: 'send',
      });
    }
    // } else {
    //   return res.json({
    //     statusCode: '305',
    //     status: 'Failed',
    //     Description: 'Signature Mismatch',
    //     clientId: payinDto.encryptedData,
    //   });
  }

  async generateTokenIFNotExist(): Promise<string> {
    const nowEpoch = dayjs().unix();
    this.logger.log(
      'Checking APEX token validity nowEpoch is' +
        nowEpoch +
        'expiryEpoch is' +
        this.expiryEpoch,
    );
    console.log('1', this.cachedToken);
    console.log('2', nowEpoch);
    console.log('3', this.expiryEpoch);
    if (!this.cachedToken || nowEpoch >= this.expiryEpoch) {
      this.logger.log('Token expired or missing, fetching new token');
      await this.fetchNewToken();
    } else {
      this.logger.log('Reusing valid APEX token.');
    }
    console.log('this.cachedToken', this.cachedToken);
    return this.cachedToken;
  }

  async fetchNewToken() {
    try {
      const loginUrl = 'https://api.apexio.co.in/auth/merchant/login';

      const requestBody = {
        username: 'AX0047',
        password: 'TrustPay@',
      };
      const headers = {
        'Content-Type': 'application/json',
      };

      const response = await firstValueFrom(
        this.httpService.post(loginUrl, requestBody, { headers }),
      );
      const responseData = response.data.data;
      if (response.status === 200 && responseData) {
        const payload = responseData.token.split('.')[1];

        const base64UrlDecode = (str) => {
          const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
          const decoded = atob(base64);
          return decodeURIComponent(
            [...decoded]
              .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
              .join(''),
          );
        };
        const decodedPayload = JSON.parse(base64UrlDecode(payload));
        this.cachedToken = responseData.token;

        this.expiryEpoch = decodedPayload.exp;

        this.logger.log(
          'New APEX token fetched. Expires at' + this.expiryEpoch,
        );
      } else {
        this.logger.error('APEX login failed: HTTP {}', responseData);
      }
    } catch (error) {
      this.logger.error('Error while fetching APEX token: {}', error);
    }
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

  async generatedOrderGId(liveOrderObject): Promise<any> {
    const tid = 'OID' + (await this.getAlphaNumericString(15));

    const query = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_order)
      .where({
        order_gid: tid,
      })
      .first();

    if (!query) {
      liveOrderObject.order_gid = tid;

      const result = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_order)
        .insert(liveOrderObject)
        .returning('*')
        .then((result) => result[0]);

      return result;
    } else {
      await this.generatedOrderGId(liveOrderObject);
    }
  }

  async saveLivePayment(livePaymentObject): Promise<any> {
    const tid = 'TP' + (await this.getAlphaNumericString(15));
    const query = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_payment)
      .where({ vendor_transaction_id: tid })
      .first();

    if (!query) {
      livePaymentObject.transaction_gid = tid;
      livePaymentObject.created_date = dayjs()
        .tz('Asia/Kolkata')
        .format('YYYY-MM-DD HH:mm:ss');
      livePaymentObject.adjustment_done = 'N';
      const result = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_payment)
        .insert(livePaymentObject)
        .returning('*')
        .then((result) => result[0]);
      return result;
    } else {
      await this.saveLivePayment(livePaymentObject);
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
