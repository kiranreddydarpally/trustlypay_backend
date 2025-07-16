import {
  BadRequestException,
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
import { IVendorbank } from 'src/interfaces/vendor-bank.interface';
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
import { WebhookTriggerDto } from './dto/webhook-trigger.dto';
import { ILiveWebhook } from 'src/interfaces/live-webhook.interface';

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
          const apxTimestamp = dayjs()
            .tz('Asia/Kolkata')
            .format('YYYY-MM-DDTHH:mm:ss.SSSZ');

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
          const token = await this.generateTokenIfNotExist();
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

  async generateTokenIfNotExist(): Promise<string> {
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

  async webHookTrigger(webhookTriggerDto: WebhookTriggerDto): Promise<string> {
    this.logger.log('========== webHookTrigger called ==========');
    this.logger.log('webhookTriggerDto  ' + JSON.stringify(webhookTriggerDto));

    return 'Hello World! this is kiran';
  }

  async payinWebhook(payinWebHookDto: PayinWebHookDto): Promise<any> {
    this.logger.log('========== APEX CALLBACK HIT RECEIVED ==========');
    this.logger.log('payinWebHookDto' + JSON.stringify(payinWebHookDto));
    const meta = payinWebHookDto?.meta ?? {};
    const webHookresponseCode: string = meta?.response_code ?? '';
    const message: string = meta?.message ?? '';

    const data = payinWebHookDto?.data ?? {};
    const paymentId = data?.apx_payment_id ?? 0;
    const clientRefId = data.client_ref_id ?? '';
    const amount = data.amount ?? 0.0;
    const currency = data.currency ?? '';
    const bankId = data.bank_reference ?? '';
    const status = data.status ?? '';
    const service = data.service ?? '';

    const createdAt = data.created_at ?? '';
    const serviceCharge = data.service_charge ?? 0.0;
    const errors = Array.isArray(payinWebHookDto?.errors)
      ? payinWebHookDto.errors
      : [];

    this.logger.log(
      'payinWeebHookDto?.errors ' + JSON.stringify(payinWebHookDto?.errors),
    );
    this.logger.log('errors ' + JSON.stringify(errors));

    if (errors && errors.length > 0) {
      this.logger.warn(`APEX Errors : ${JSON.stringify(errors)}`);
    }
    const serviceDetails = data.service_details ?? {};
    const upi = serviceDetails.upi ?? {};
    const channel = upi.channel ?? '';

    // Log or process extracted values
    this.logger.log('Parsed values - paymentId ' + paymentId);
    this.logger.log('Parsed values - clientRefId ' + clientRefId);
    this.logger.log('Parsed values - amount: ' + amount);
    this.logger.log('Parsed values - status ' + status);
    this.logger.log('Parsed values - channel ' + channel);

    this.logger.log(
      'Parsed values - Payment ID: {}, Client Ref: {}, Amount: {}, Status: {}, Channel: {}' +
        paymentId,
      clientRefId,
      amount,
      status,
      channel,
    );
    this.logger.log(
      'apex webhook Response TID :  ' +
        clientRefId +
        'status ' +
        status +
        ' amount ' +
        amount,
    );

    const livePayment: IlivePayment = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_payment)
      .where({ transaction_gid: clientRefId })
      .first();
    this.logger.log('livePayment  ' + JSON.stringify(livePayment));
    const txn_status = status; // comes from "data.status"
    const status_code = webHookresponseCode; // comes from "meta.response_code"
    const description = message;
    this.logger.log('txn_status  ' + txn_status);
    if (['success', 'failure', 'pending'].includes(txn_status.toLowerCase())) {
      console.log('ok');

      const liveMerchantapi: ILiveMerchantApi = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_merchantapi)
        .where({ created_merchant: livePayment.created_merchant })
        .first();
      this.logger.log('liveMerchantapi ' + JSON.stringify(liveMerchantapi));

      const statusToSave =
        txn_status === 'failure' ? 'failed' : txn_status.toLowerCase();
      const livePaymentObject = {
        transaction_status: statusToSave,
        transaction_description: description,
        bank_ref_no: bankId,
        transaction_mode: 'UPI',
        transaction_date: dayjs()
          .tz('Asia/Kolkata')
          .format('YYYY-MM-DD HH:mm:ss'),
        transaction_type: 'UPI',
      };
      // update livePay
      const livePaymentUpdate: IlivePayment = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_payment)
        .where('transaction_gid', '=', clientRefId)
        .update(livePaymentObject)
        .returning('*')
        .then((result) => result[0]);

      this.logger.log('livePaymentUpdate ' + JSON.stringify(livePaymentUpdate));
      this.logger.log(
        'livePaymentUpdate.order_id ' + livePaymentUpdate.order_id,
      );
      let liveWebhook: ILiveWebhook = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_webhook)
        .where('created_merchant', '=', livePayment.created_merchant)
        .returning('*')
        .then((result) => result[0]);
      if (!liveWebhook) {
        this.logger.error('--ERROR-- ' + liveWebhook);
        throw new BadRequestException('webhook not found');
      }
      this.logger.log('liveWebhook' + liveWebhook);
      const merchantUrl =
        liveWebhook?.webhook_url ??
        'http://localhost:3000/api/payin/webhook-trigger';

      let liveOrderUpdate: ILiveOrder = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_order)
        .where('id', '=', livePaymentUpdate.order_id)
        .returning('*')
        .then((result) => result[0]);
      this.logger.log('liveOrderUpdated ' + JSON.stringify(liveOrderUpdate));

      if (txn_status.toLowerCase() === 'success') {
        liveOrderUpdate = await this._knex
          .withSchema(process.env.DB_SCHEMA || 'public')
          .table(tableNames.live_order)
          .where('id', '=', livePaymentUpdate.order_id)
          .update({ order_status: 'Paid' })
          .returning('*')
          .then((result) => result[0]);

        this.logger.log('liveOrderUpdate ' + JSON.stringify(liveOrderUpdate));
      }
      this.logger.log('merchantUrl ' + merchantUrl);

      if (merchantUrl) {
        let signature = '';
        try {
          signature = crypto
            .createHmac('sha256', liveMerchantapi.response_hashkey)
            .update(
              status_code +
                liveOrderUpdate.order_gid +
                livePaymentUpdate.transaction_gid +
                String(bankId) +
                livePaymentUpdate.transaction_description,
            )
            .digest('hex');

          this.logger.log('webhook signature ', signature);
        } catch (error) {
          this.logger.log('webhook signature values exception ' + error);
        }
        const options: any = {
          status: status_code,
          clientId: liveMerchantapi.api_key,
          orderId: liveOrderUpdate.order_gid,
          transactionId: livePaymentUpdate.transaction_gid,
          bankId: livePaymentUpdate.bank_ref_no,
          amount: livePaymentUpdate.transaction_amount,
          emailId: livePaymentUpdate.transaction_email,
          mobileNumber: livePaymentUpdate.transaction_contact,
          date: livePaymentUpdate.transaction_date,
          signature: signature,
          txnstatus: livePaymentUpdate.transaction_status,
          description: livePaymentUpdate.transaction_description,
          transaction_type: livePaymentUpdate.transaction_type,
          udf1: livePaymentUpdate.udf1,
          udf2: livePaymentUpdate.udf2,
          udf3: livePaymentUpdate.udf3,
          udf4: livePaymentUpdate.udf4,
          udf5: livePaymentUpdate.udf5,
        };

        if (!livePaymentUpdate.transaction_response) {
          options.transaction_method_id =
            livePaymentUpdate.transaction_method_id;
        }
        this.logger.log(
          'webhook Data to be pass in web hook ' + JSON.stringify(options),
        );
        let secureData = '';
        try {
          secureData = await this.encryptData(
            JSON.stringify(options),
            liveMerchantapi.response_salt_key,
            liveMerchantapi.encryption_response_key,
          );
        } catch (error) {
          this.logger.error('Intentpay encrypt webhookRes : ' + error);
        }
        this.logger.log('secureData : ' + secureData);
        let isWebHookSend: boolean = false;
        try {
          const headers = {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/535.11 (KHTML, like Gecko) Chrome/17.0.963.56 Safari/535.11',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/json',
          };
          const requestBody = {
            clientId: liveMerchantapi.api_key, // equivalent of liveApi.getApi_key()
            secureData: secureData,
          };

          const response = await firstValueFrom(
            this.httpService.post(merchantUrl, requestBody, { headers }),
          );

          this.logger.log('clientId ' + liveMerchantapi.api_key);
          this.logger.log('response status for clientId ' + response.status);
          this.logger.log('response data for clientId ' + response.data);
          isWebHookSend = true;
        } catch (error) {
          this.logger.log('Error inside Apex webhook : ' + error);
        }
        this.logger.log('Apex webhook send: ' + isWebHookSend);
      } else {
        this.logger.log('Merchant Url is blank ' + merchantUrl);
      }
    } else {
      this.logger.error(
        "payment don't have success or failure or pending " +
          JSON.stringify(payinWebHookDto),
      );
    }
  }

  async buildErrorResponse(
    statusCode: string,
    description: string,
    clientId: string,
    encryptedData: string,
  ) {
    return {
      statusCode: statusCode,
      status: 'Failed',
      description: description,
      clientId: clientId,
      encryptedData: encryptedData,
    };
  }

  async buildFieldMissingResponse(fieldName: string) {
    return {
      statusCode: '307',
      status: 'Failed',
      DEscription: fieldName + ' is Empty.',
    };
  }

  async StatusCheck(payinDto: PayinDto): Promise<any> {
    this.logger.log(
      '========== StatusCheck Incoming Request Body ==========' +
        JSON.stringify(payinDto),
    );
    const apiKey = payinDto.clientId;
    const encryptedData = payinDto.encryptedData;

    if (!apiKey) {
      return await this.buildErrorResponse(
        '301',
        'Client ID is Required.',
        apiKey,
        encryptedData,
      );
    }

    if (!encryptedData) {
      return await this.buildErrorResponse(
        '302',
        'encryptedData is Required.',
        apiKey,
        encryptedData,
      );
    }

    const liveMerchantapi: ILiveMerchantApi = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_merchantapi)
      .where({ api_key: payinDto.clientId })
      .first();

    if (!liveMerchantapi) {
      return this.buildErrorResponse(
        '303',
        'Invalid Client Id',
        apiKey,
        encryptedData,
      );
    }

    let decryptedData: {
      clientId: string;
      clientSecret: string;
      amount: string;
      udf1: string;
      transactionId: string;
    };

    try {
      decryptedData = JSON.parse(
        await this.decryptData(
          encryptedData,
          liveMerchantapi.encryption_request_key,
          liveMerchantapi.request_salt_key,
        ),
      );
      this.logger.log('decryptedData ' + JSON.stringify(decryptedData));
    } catch (error) {
      return await this.buildErrorResponse(
        '304',
        'Invalid Encrypted Data',
        apiKey,
        encryptedData,
      );
    }

    const amount = decryptedData.amount;
    const clientId = decryptedData.clientId;
    const clientKey = decryptedData.clientSecret;
    const udf1 = decryptedData.udf1;
    const transactionId = decryptedData.transactionId;

    if (!amount) {
      return await this.buildFieldMissingResponse('amount');
    }
    if (!clientKey) {
      return await this.buildFieldMissingResponse('clientKey');
    }
    if (!udf1) {
      return await this.buildFieldMissingResponse('udf1');
    }
    if (!transactionId) {
      return await this.buildFieldMissingResponse('transactionId');
    }

    let livePayment: IlivePayment = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_payment)
      .where('transaction_gid', '=', transactionId)
      .returning('*')
      .then((result) => result[0]);

    this.logger.log('livePayment ' + JSON.stringify(livePayment));

    let liveJsonSD = {};

    if (!livePayment) {
      this.logger.warn(
        'Transaction not found in live_payment. Checking in live_payment_bkp...',
      );
      livePayment = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.live_payment_bkp)
        .where('transaction_gid', '=', transactionId)
        .returning('*')
        .then((result) => result[0]);
      this.logger.log('live_payment_bkp ' + livePayment);
    }

    if (!livePayment) {
      return await this.buildErrorResponse(
        '305',
        'Cannot Find Transaction with your transactionId i.e., ' +
          transactionId,
        apiKey,
        encryptedData,
      );
    } else {
      liveJsonSD = {
        transactionId: livePayment.transaction_gid,
        bankRefNo: livePayment.bank_ref_no,
        transactionType: livePayment.transaction_type,
        userName: livePayment.transaction_username,
        amount: livePayment.transaction_amount,
        status: livePayment.transaction_status,
        udf1: livePayment.udf1,
      };
    }
    this.logger.log('liveJsonSD ' + JSON.stringify(liveJsonSD));

    let encryptedResponse = '';
    try {
      encryptedResponse = await this.encryptData(
        JSON.stringify(liveJsonSD),
        liveMerchantapi.encryption_response_key,
        liveMerchantapi.response_salt_key,
      );
      this.logger.log('Final Encrypted Response ' + encryptedResponse);
    } catch (error) {
      this.logger.error('Error while encrypting response data ' + error);
    }
    const jsonObject = { clientId: clientId, encryptedData: encryptedResponse };

    this.logger.log(
      'Final Response Payload Sent to Client: ' + JSON.stringify(jsonObject),
    );

    return jsonObject;
  }
}
