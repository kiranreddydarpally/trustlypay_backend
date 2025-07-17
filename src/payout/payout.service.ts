import {
  BadRequestException,
  Inject,
  Injectable,
  LoggerService,
} from '@nestjs/common';
import { PayoutDto } from './dto/payout.dto';
import { Request } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Knex } from 'src/knex/knex.interface';
import { tableNames } from 'src/enums/table-names.enum';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { ILiveMerchantApi } from 'src/interfaces/live-merchantapi.interface';
import * as crypto from 'crypto';
import { plainToInstance } from 'class-transformer';
import { TransferDetailsDto } from './dto/transfer-details.dto';
import { validate } from 'class-validator';
import { IMerchantPayoutIpwhitelist } from 'src/interfaces/merchan-payout-ipwhitelist.interface';
import { PayinService } from 'src/payin/payin.service';
import { IMerchantPayoutVendor } from 'src/interfaces/merchant-payout-vendor.interface';
import { IMerchantPayoutCharges } from 'src/interfaces/merchant-payout-charges.interface';
import { IPayoutDecodeResponse } from './interfaces/payout.decode.response.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { IPayoutBalance } from 'src/interfaces/payout-balance.interface';
dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class PayoutService {
  constructor(
    private readonly payinService: PayinService,

    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,

    @Inject(KNEX_CONNECTION) private readonly _knex: Knex,

    private readonly httpService: HttpService,
  ) {}

  async directPayoutTransfer(payoutDto: PayoutDto, req: Request) {
    this.logger.log('----- PAYOUT TRANSFER -----');
    this.logger.log('Request IP Address ' + req.ip);
    this.logger.log('Request IP Address ' + req.headers['x-forwarded-for']);
    this.logger.log('Request clientId ' + payoutDto.clientId);
    this.logger.log('Request encrypt data ' + payoutDto.encrypt);

    const liveMerchantapi: ILiveMerchantApi = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.live_merchantapi)
      .where({
        api_key: payoutDto.clientId,
      })
      .first();
    this.logger.log('liveMerchantapi ' + JSON.stringify(liveMerchantapi));

    let errorResponse = {};
    if (!liveMerchantapi) {
      errorResponse = {
        Description: 'Your clientId is invalid',
        clientId: payoutDto.clientId,
        encryptedData: payoutDto.encrypt,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      throw new BadRequestException('Your clientId is invalid');
    }

    const ipAddress: IMerchantPayoutIpwhitelist = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.merchant_payout_ipwhitelist)
      .where({
        merchant_id: liveMerchantapi.created_merchant,
        ipwhitelist: req.ip,
      })
      .first();
    // TODO check ip address
    const key = liveMerchantapi.api_secret;
    let decrypted_string: IPayoutDecodeResponse;

    try {
      decrypted_string = JSON.parse(
        JSON.parse(await this.decryptAES128ECB(payoutDto.encrypt, key)),
      );
      if (!decrypted_string) {
        throw new BadRequestException('Invalid Encrypted ');
      }
    } catch (error) {
      errorResponse = {
        message: error,
        clientId: payoutDto.clientId,
        encryptedData: payoutDto.encrypt,
      };
      this.logger.error('--ERROR-- ' + JSON.stringify(errorResponse));
      throw new BadRequestException(errorResponse);
    }
    this.logger.log('decryptedData ' + JSON.stringify(decrypted_string));
    const dtoObject = plainToInstance(TransferDetailsDto, decrypted_string);
    const errors = await validate(dtoObject);

    if (errors.length > 0) {
      const validationErrors = errors.reduce((acc, err) => {
        acc[err.property] = Object.values(err.constraints || {});
        return acc;
      }, {});
      return {
        statusCode: 400,
        message: validationErrors,
      };
    }
    this.logger.log('dtoObject ' + JSON.stringify(dtoObject));

    const merchantPayoutVendor: IMerchantPayoutVendor = await this._knex
      .withSchema(process.env.DB_SCHEMA || 'public')
      .table(tableNames.merchant_payout_vendor)
      .where({
        merchant_id: liveMerchantapi.created_merchant,
      })
      .first();
    this.logger.log(
      'merchantPayoutVendor ' + JSON.stringify(merchantPayoutVendor),
    );

    if (!merchantPayoutVendor) {
      throw new BadRequestException("The vendor's bank is not assigned");
    }
    const order_id = 'TP' + (await this.payinService.getAlphaNumericString(13));
    this.logger.log('order_id ' + order_id);

    if (merchantPayoutVendor.imps === '1') {
      const merchantPayoutCharges: IMerchantPayoutCharges = await this._knex
        .withSchema(process.env.DB_SCHEMA || 'public')
        .table(tableNames.merchant_payout_charges)
        .where({
          merchant_id: liveMerchantapi.created_merchant,
        })
        .first();

      this.logger.log(
        'merchantPayoutCharges ' + JSON.stringify(merchantPayoutCharges),
      );

      if (!merchantPayoutCharges) {
        throw new BadRequestException(
          'There is no transaction amount limit. Please request the administrator to set a transaction amount limit.',
        );
      }

      if (
        Number(decrypted_string.amount) >
        Number(merchantPayoutCharges.min_range)
      ) {
        if (
          Number(decrypted_string.amount) <
          Number(merchantPayoutCharges.max_range)
        ) {
          const get_percentage = await this._knex
            .withSchema(process.env.DB_SCHEMA || 'public')
            .table(tableNames.merchant_payout_charges)
            .where({
              merchant_id: liveMerchantapi.created_merchant,
              type: 'percentage',
            })
            .first();
          this.logger.log('get_percentage ' + JSON.stringify(get_percentage));

          const get_flat = await this._knex
            .withSchema(process.env.DB_SCHEMA || 'public')
            .table(tableNames.merchant_payout_charges)
            .where({
              merchant_id: liveMerchantapi.created_merchant,
              type: 'flat',
            })
            .first();
          this.logger.log('get_flat ' + JSON.stringify(get_flat));

          let total_charge = 0;
          let tax_charges = 0;
          if (get_percentage) {
            if (get_flat) {
              const amount = Number(decrypted_string.amount);

              if (get_flat.volume_count < amount) {
                total_charge = (get_percentage.UPI / 100) * amount;
                tax_charges = (18 / 100) * total_charge;
              } else {
                total_charge = get_flat.UPI;
                tax_charges = (18 / 100) * total_charge;
              }
            }
          }
          const amount_tax =
            Number(decrypted_string.amount) + total_charge + tax_charges;
          this.logger.log('merchant ' + Number(decrypted_string.amount));

          this.logger.log('total_charge ' + total_charge);
          this.logger.log('tax_charges ' + tax_charges);
          this.logger.log('amount_tax' + amount_tax);

          const body = {
            username: 'AX0047',
            password: 'TrustPay@',
          };

          const url = 'https://api.apexio.co.in/auth/merchant/login';
          const headers = {
            'Content-Type': 'application/json',
          };
          this.logger.log('payout_auth url' + url);
          this.logger.log('payout_auth body ' + JSON.stringify(body));
          this.logger.log('payout_auth headers ' + JSON.stringify(headers));

          const apexAuthResponse = await firstValueFrom(
            this.httpService.post(url, body, { headers }),
          );
          this.logger.log(
            'apexAuthResponse.data ' + JSON.stringify(apexAuthResponse.data),
          );

          const payout_payment_details = {
            merchant_reference_id: order_id,
            amount: decrypted_string.amount,
            currency: 'INR',
            service: 'payout',
            service_details: {
              payout: {
                channel: 'IMPS',
                payee_details: {
                  payee_name: decrypted_string.name,
                  payee_bank_ifsc: decrypted_string.ifsc_code,
                  payee_bank_account_no: decrypted_string.account_no,
                },
              },
            },
            customer_details: {
              customer_mobile: decrypted_string.phone,
              customer_name: decrypted_string.name,
              customer_email: decrypted_string.email,
            },
            geo_location: {
              latitude: '17.385044',
              longitude: '78.486671',
            },
            webhook_url:
              'https://merchant.trustlypay.com/sapi/apexio/payout/response',
          };
          const formatted = dayjs()
            .tz('Asia/Kolkata')
            .format('YYYY-MM-DDTHH:mm:ss.SSSZ');
          const service = 'payout';
          const merchantReferenceId = order_id;
          const payeeBankAccountNo = decrypted_string.account_no;
          const secretKey = '1EDCD414A0B778933AA836E2BB8DD61E';
          let truncated = Math.trunc(Number(decrypted_string.amount) * 10) / 10;

          const data =
            truncated.toFixed(1) +
            '|' +
            service +
            '|' +
            merchantReferenceId +
            '|' +
            payeeBankAccountNo;
          const hmacHash = crypto.createHmac('sha256', secretKey).update(data);
          const apxSignature = hmacHash.digest('base64');
          const authorization = apexAuthResponse['data']['data']['token'];
          this.logger.log('hmacHash ' + JSON.stringify(apxSignature));
          this.logger.log('authorization ' + JSON.stringify(authorization));

          const trx = await this._knex.transaction();

          try {
            const balance: IPayoutBalance = await trx
              .withSchema(process.env.DB_SCHEMA || 'public')
              .table(tableNames.payout_balance)
              .where({
                merchant_id: liveMerchantapi.created_merchant,
              })
              .forUpdate()
              .first();
            this.logger.log('balance ' + JSON.stringify(balance));
            this.logger.log('amount_tax ' + amount_tax);
            this.logger.log('balance.balance ' + balance.balance);

            if (!balance) {
              await trx.rollback();
              this.logger.error(
                '-- ERROR -- Insufficient balance - Please add balance in your Account',
              );

              throw new BadRequestException(
                'Please add balance in your Account. Insufficient balance',
              );
            }

            if (amount_tax > Number(balance.balance)) {
              await trx.rollback();
              this.logger.error(
                ' amount_tax should be less than balance.balance. amount_tax is ->' +
                  amount_tax +
                  'balance.balance is ->' +
                  balance.balance,
              );
              throw new BadRequestException('Insufficient balance.');
            }

            const url = 'https://api.apexio.co.in/transaction/initiate';
            this.logger.log('Apexio-payout transfer request' + url);
            const headers = {
              'Content-Type': 'application/json',
              'apx-timestamp': formatted,
              'apx-signature': apxSignature,
              Authorization: `Bearer ${authorization}`,
            };
            // const response = {
            //   data: {
            //     meta: {
            //       response_code: 'APX_000',
            //       message: 'SUCCESS',
            //     },
            //     data: {
            //       apx_transaction_id: 'APXXXXX',
            //       merchant_refereence_id: 'XXXXXXXXXXXXXXXX',
            //       status: 'success',
            //       service_charge: 0.21,
            //       bank_reference_no: 'XXXXXXXXXXXXXXX',
            //       created_at: null,
            //       remark: 'SUCCESS',
            //     },
            //     errors: null,
            //   },
            // };
            const response = await firstValueFrom(
              this.httpService.post(url, payout_payment_details, { headers }),
            );

            this.logger.log('response.data ' + JSON.stringify(response.data));

            if (
              !response.data ||
              response.data['meta']['message'] === 'FAILED' ||
              response.data['meta']['response_code'] === 'APX_001'
            ) {
              await trx.rollback();
              this.logger.error(
                'Payout transfer failed - amount refunded - ' + amount_tax,
              );
              throw new BadRequestException(
                response.data['meta']['message'] ??
                  'Getting error in payout transfer',
              );
            }

            const debitSuccess = await trx
              .withSchema(process.env.DB_SCHEMA || 'public')
              .table(tableNames.payout_balance)
              .where({ merchant_id: liveMerchantapi.created_merchant })
              .decrement('balance', amount_tax)
              .returning('*')
              .then((rows) => rows[0]);

            this.logger.log('debitSuccess ' + JSON.stringify(debitSuccess));

            if (!debitSuccess) {
              await trx.rollback();
              this.logger.log('Balance decrement failed');
              throw new BadRequestException('Failed to debit balance');
            }

            const updatedBalance: IPayoutBalance = await trx
              .withSchema(process.env.DB_SCHEMA || 'public')
              .table(tableNames.payout_balance)
              .where('merchant_id', liveMerchantapi.created_merchant)
              .forUpdate()
              .first();
            this.logger.log('balance ' + JSON.stringify(updatedBalance));

            let statusDescription;
            if (response.data['data']['status'] == 'SUCCESS') {
              statusDescription = 'Transaction Status Success';
            } else if (response.data['data']['status'] == 'PENDING') {
              statusDescription = 'Transaction Status Pending';
            } else if (response.data['data']['status'] == 'FAILED') {
              statusDescription = 'Transaction Status Failed';
            } else {
              statusDescription = 'Transaction Status Pending';
            }
            const udf1_data = decrypted_string['udf1'] ?? '';
            await trx
              .withSchema(process.env.DB_SCHEMA || 'public')
              .insert({
                merchant_id: liveMerchantapi.created_merchant,
                amount: amount_tax,
                balance: updatedBalance.balance,
                type: 'debit',
                created_date: dayjs()
                  .tz('Asia/Kolkata')
                  .format('YYYY-MM-DD HH:mm:ss'),
              })
              .into(tableNames.payout_balance_transaction);

            await trx
              .withSchema(process.env.DB_SCHEMA || 'public')
              .insert({
                reference_id: response.data.data.apx_transaction_id,
                utr: response.data.data.bank_reference_no,
                merchant_id: liveMerchantapi.created_merchant,
                transfer_id: order_id,
                ben_id: '',
                ben_name: decrypted_string.name,
                ben_phone: decrypted_string.phone,
                ben_email: decrypted_string.email,
                ben_upi: '',
                ben_card_no: null,
                ben_ifsc: decrypted_string.ifsc_code,
                ben_bank_acc: decrypted_string.account_no,
                amount: decrypted_string.amount,
                transfer_mode: decrypted_string.transferMode,
                status: response.data.data.status,
                remarks: response.data.data.remark,
                purpose: decrypted_string.purpose,
                transfer_desc: statusDescription,
                vendor_desc: response.data.meta.message,
                vendor_charges: total_charge,
                goods_service_tax: tax_charges,
                vendor: merchantPayoutVendor.imps,
                created_at: new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' '),
                transfer_type: null,
                udf1: udf1_data,
                udf2: '',
                udf3: '',
                udf4: '',
                udf5: '',
              })
              .into(tableNames.payout_transactions);

            await trx.commit();
            const respose_data = {
              statusCode: 200,
              date: dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
              amount: decrypted_string['amount'],
              orderId: order_id,
              status: response.data['data']['status'],
              desc: statusDescription,
              bankId: response.data['data']['bank_reference_no'],
            };
            const key = liveMerchantapi.api_secret;
            this.logger.log(
              'JSON.stringify(response.data) ' + JSON.stringify(response.data),
            );
            const encrypted_string = await this.encryptAES128ECB(
              JSON.stringify(response.data),
              key,
            );
            this.logger.log(
              'Apexio-payout transfer final response ' +
                JSON.stringify(encrypted_string),
            );

            return encrypted_string;
          } catch (err) {
            await trx.rollback();
            throw err;
          }
        } else {
          throw new BadRequestException({
            message:
              'Transaction amount must be less than ' +
              merchantPayoutCharges.max_range,
          });
        }
      } else {
        throw new BadRequestException({
          message:
            'Transaction amount must be greater than ' +
            merchantPayoutCharges.min_range,
        });
      }
    }
  }

  async decryptAES128ECB(
    encryptedBase64: string,
    key: string,
  ): Promise<string> {
    const cipherKey = Buffer.from(key, 'utf8');

    const decipher = crypto.createDecipheriv('aes-128-ecb', cipherKey, null);
    decipher.setAutoPadding(true);

    const decrypted = Buffer.concat([
      decipher.update(encryptedBase64, 'base64'),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  async encryptAES128ECB(data: any, key: string): Promise<string> {
    const plaintext = JSON.stringify(data);
    const cipherKey = Buffer.from(key, 'utf8');

    const cipher = crypto.createCipheriv('aes-128-ecb', cipherKey, null);
    cipher.setAutoPadding(true);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return encrypted.toString('base64');
  }
}
