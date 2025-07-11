import {
  HttpException,
  Inject,
  Injectable,
  LoggerService,
} from '@nestjs/common';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
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
import { IApexResponse } from 'src/interfaces/apex-response.interface';
import { ILiveMerchantApi } from 'src/interfaces/live-merchantapi.interface';
import { ILiveOrder } from 'src/interfaces/live-order.interface';
import { tableNames } from 'src/enums/table-names.enum';
import { IlivePayment } from 'src/interfaces/live-payment.interface';
import { IMerchantVendorBank } from 'src/interfaces/merchant-vendor-bank.interface';
import { PayinWebHookDto } from './dto/payin-webhook.dto';

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
    this.logger.log('Post Request From Merchant ' + JSON.stringify(payinDto));
    let errorResponse = {};

    if (!payinDto.clientId || payinDto.clientId === '') {
      errorResponse = {
        statusCode: '301',
        status: 'Failed',
        Description: 'clientId is Required.',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      return res.json(errorResponse);
    }

    if (!payinDto.encryptedData || payinDto.encryptedData === '') {
      errorResponse = {
        statusCode: '302',
        status: 'Failed',
        Description: 'encryptedData is Required.',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      return res.json(errorResponse);
    }

    //Check live_merchantapi table and get data
    const liveMerchantapi: ILiveMerchantApi = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_merchantapi)
      .where({ api_key: payinDto.clientId })
      .first();

    if (!liveMerchantapi) {
      errorResponse = {
        statusCode: '303',
        status: 'Failed',
        Description: 'Invalid Client Id',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      return res.json(errorResponse);
    }
    const createdMerchant = liveMerchantapi.created_merchant;
    const responseSaltKey = liveMerchantapi.response_salt_key;
    const responseAESKey = liveMerchantapi.encryption_response_key;
    const requestHashKey = liveMerchantapi.request_hashkey;
    const apiSecret = liveMerchantapi.api_secret;
    let decryptedData: IDecodeResponse;

    try {
      decryptedData = JSON.parse(
        await this.decryptData(
          payinDto.encryptedData,
          liveMerchantapi.encryption_request_key,
          liveMerchantapi.request_salt_key,
        ),
      );
    } catch (Exception) {
      errorResponse = {
        statusCode: '305',
        status: 'Failed',
        Description: 'Invalid Encrypted Data',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      return res.json(errorResponse);
    }
    this.logger.log('decryptedData ', decryptedData);

    const clientId = decryptedData.clientId;
    const txnCurr = decryptedData.txnCurr;
    const amount = Number(decryptedData.amount);
    const emailId = decryptedData.emailId;
    const signature = decryptedData.signature;
    const mobileNumber = decryptedData.mobileNumber;
    const username = decryptedData.username;
    const udf1 = decryptedData.udf1;
    const udf2 = decryptedData.udf2;
    let encodeSignature = '';

    encodeSignature = crypto
      .createHmac('sha256', requestHashKey)
      .update(
        clientId +
          apiSecret +
          txnCurr +
          amount +
          emailId +
          mobileNumber +
          username,
      )
      .digest('hex');

    let finalJsonForEncrypt = {};

    if (encodeSignature === signature) {
      const liveOrderObject = {
        order_amount: amount,
        order_status: 'Created',
        created_date: dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        created_merchant: createdMerchant,
      };
      const liveOrder = await this.saveliveOrder(liveOrderObject);

      this.logger.log('liveOrder created ' + JSON.stringify(liveOrder));
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
      const merchantVendorBank: IMerchantVendorBank = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.merchant_vendor_bank)
        .where({ merchant_id: createdMerchant })
        .first();
      this.logger.log(
        'merchantVendorBank ' + JSON.stringify(merchantVendorBank),
      );

      const vendorbank: IVendorbank = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.vendor_bank)
        .where({ id: merchantVendorBank.upi })
        .first();

      this.logger.log('vendorbank ' + JSON.stringify(vendorbank));

      let intetntString = '';
      let vtransactionId = '';

      // update vendorid
      const vendorBankIdUpdated: IlivePayment = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_payment)
        .where('transaction_gid', '=', livePayment.transaction_gid)
        .update({
          vendor_id: vendorbank.id,
        })
        .returning('*')
        .then((result) => result[0]);

      this.logger.log('query' + JSON.stringify(vendorBankIdUpdated));

      if (vendorbank.id > 0 && vendorbank.bank_name === 'Apexio') {
        const APEX_API_URL = 'https://api.apexio.co.in/transaction/initiate';
        try {
          // 1. Prepare timestamp in ISO8601
          const apxTimestamp = dayjs().tz('Asia/Kolkata').format();

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

          this.logger.log('apx-signature' + apxSignature);

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
          const response: IApexResponse = await firstValueFrom(
            this.httpService.post(APEX_API_URL, body, { headers }).pipe(
              retryWhen((errors) =>
                errors.pipe(
                  scan((retryCount, error) => {
                    const status = error?.response?.status;

                    this.logger.error(
                      `APEX call failed [${status}] - Attempt ${retryCount + 1} : ${error.message}`,
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
                this.logger.error('Final error after retries ' + err.message);
                return throwError(() => err);
              }),
            ),
          );
          const responseData = response.data;
          this.logger.log('APEX Response ' + JSON.stringify(responseData));

          if (
            'APX_000' === responseData.meta.response_code &&
            responseData.data
          ) {
            vtransactionId = responseData.data?.apx_payment_id ?? '';
            intetntString = responseData.data?.payload.url ?? '';
          } else {
            this.logger.error('APEX Response: ' + JSON.stringify(responseData));

            return res.json({
              statusCode: '304',
              status: 'Failed',
              Description:
                'Apologies for the inconvenience. Kindly inform me at the earliest possible moment',
              clientId: payinDto.clientId,
              encryptedData: payinDto.encryptedData,
            });
          }
        } catch (error) {
          if (error instanceof HttpException) {
            this.logger.error(
              'HttpException Exception of APEX StatusCode is ' +
                error.getStatus(),
            );
            this.logger.error(
              'HttpException Exception of APEX response is ' +
                error.getResponse(),
            );
            return res.json({
              statusCode: '304',
              status: 'Failed',
              Description:
                'Apologies for the inconvenience. Kindly inform me at the earliest possible moment',
              clientId: payinDto.clientId,
              encryptedData: payinDto.encryptedData,
            });
          } else {
            this.logger.error('General Exception of APEX ' + error);
            return res.json({
              statusCode: '304',
              status: 'Failed',
              Description:
                'Apologies for the inconvenience. Kindly inform me at the earliest possible moment',
              clientId: payinDto.clientId,
              encryptedData: payinDto.encryptedData,
            });
          }
        }
      }

      const livePaymentUpdate: IlivePayment = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_payment)
        .where('transaction_gid', '=', livePayment.transaction_gid)
        .update({
          vendor_transaction_id: vtransactionId,
          transaction_notes: intetntString,
        })
        .returning('*')
        .then((result) => result[0]);

      this.logger.log('livePaymentUpdate ' + JSON.stringify(livePaymentUpdate));

      // Prepare final JSON for encryption
      finalJsonForEncrypt = {
        userName: username,
        emailId: emailId,
        mobileNumber: mobileNumber,
        amount: amount,
        txnCurr: txnCurr,
        orderId: liveOrder.order_gid,
        upiIntent: intetntString,
        status: 'success',
        statusCode: '200',
        description: 'Do Not Modify UPI String',
        transactionId: livePayment.transaction_gid,
        signature: signature,
        udf1: udf1,
        udf2: udf2,
      };
    } else {
      errorResponse = {
        statusCode: '305',
        status: 'Failed',
        Description: 'Signature Mismatch',
        clientId: payinDto.clientId,
        encryptedData: payinDto.encryptedData,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      return res.json(errorResponse);
    }
    this.logger.log(
      'Response JSON Data ' + JSON.stringify(finalJsonForEncrypt),
    );

    let finalEncryptedData = '';
    try {
      finalEncryptedData = await this.encryptData(
        JSON.stringify(finalJsonForEncrypt),
        responseSaltKey,
        responseAESKey,
      );
    } catch (error) {
      this.logger.error('error ' + error);
    }
    this.logger.log('final EncryptedData ' + finalEncryptedData);

    return res.send({
      clientId: clientId,
      encryptedData: finalEncryptedData,
    });
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

  async getAlphaNumericString(length: number) {
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

  async saveliveOrder(liveOrderObject): Promise<ILiveOrder> {
    const tid = 'OID' + (await this.getAlphaNumericString(15));

    const query: ILiveOrder = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_order)
      .where({
        order_gid: tid,
      })
      .first();

    if (!query) {
      liveOrderObject.order_gid = tid;

      const result: ILiveOrder = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_order)
        .insert(liveOrderObject)
        .returning('*')
        .then((result) => result[0]);

      return result;
    } else {
      return await this.saveliveOrder(liveOrderObject);
    }
  }

  async saveLivePayment(livePaymentObject): Promise<IlivePayment> {
    const tid = 'TP' + (await this.getAlphaNumericString(15));
    const query: IlivePayment = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_payment)
      .where({ transaction_gid: tid })
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
      return await this.saveLivePayment(livePaymentObject);
    }
  }

  async decryptData(
    encryptedHex: string,
    aesKey: string,
    salt: string,
  ): Promise<string> {
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
    const saltBuffer = Buffer.from(salt, 'utf-8');

    const ivBuffer = Buffer.from([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);

    // Derive key using PBKDF2 with HMAC-SHA1, 65536 iterations, 256-bit key
    const derivedKey = crypto.pbkdf2Sync(aesKey, saltBuffer, 65536, 32, 'sha1');

    // Create AES decipher
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      derivedKey,
      ivBuffer,
    );

    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');

    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async encryptData(
    plainText: string,
    aesKey: string,
    salt: string,
  ): Promise<string> {
    const saltBytes = Buffer.from(salt, 'utf-8');
    const ivBuffer = Buffer.from([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);

    const key = crypto.pbkdf2Sync(aesKey, saltBytes, 65536, 32, 'sha1');

    const cipher = crypto.createCipheriv('aes-256-cbc', key, ivBuffer);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  async payinWebhook(payinWeebHookDto: PayinWebHookDto): Promise<any> {
    console.log('payinWeebHookDto', payinWeebHookDto);
  }
}
