import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { Knex } from 'src/knex/knex.interface';
import { KNEX_CONNECTION } from 'src/knex/knex.provider';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { tableNames } from 'src/common/enums/table-names.enum';
import { PayinDto } from './dto/payin.dto';
import * as crypto from 'crypto';

@Injectable()
export class PayinService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly salt = 'y7u7i8i9o0y7y6y7'; // 16+ chars
  private readonly ivLength = 16;

  constructor(
    @Inject(KNEX_CONNECTION) private readonly _knex: Knex,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async payIn(payinDto: PayinDto): Promise<any[]> {
    this.logger.log(payinDto);

    function decryptData(
      encryptedHex: string,
      aesKey: string,
      salt: string,
    ): string {
      const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
      const saltBuffer = Buffer.from(salt, 'utf-8');

      // Use the fixed IV from Java
      const ivBuffer = Buffer.from([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]);

      // Derive key using PBKDF2 with HMAC-SHA1, 65536 iterations, 256-bit key
      const derivedKey = crypto.pbkdf2Sync(
        aesKey,
        saltBuffer,
        65536,
        32,
        'sha1',
      );

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

    const salt = 'kjDGWtSrCwIlZKcq'; // your salt
    const aesKey = 'XLUFjWiJcdnv24tr'; // your AES key (password for PBKDF2)

    const encryptedData = payinDto.encryptedData; // your long hex string
    const result = decryptData(encryptedData, aesKey, salt);

    this.logger.log('Decrypted Data:', JSON.parse(result));

    return [];
  }

  async nestencrypt() {
    const request_key = 'MySecretPassword';

    /**
     * Encrypt data with dynamic key derived from requestKey
     */
    function encrypt(data: string, requestKey: string): string {
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.getKey(requestKey);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final(),
      ]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    /**
     * Decrypt the data using requestKey
     */
    function decrypt(encryptedData: string, requestKey: string): string {
      const [ivHex, encryptedHex] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      const key = this.getKey(requestKey);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    }
    const encrypt_data = encrypt('encryptedData is data', request_key);
    this.logger.log('Decrypted:', encrypt_data);
    const decrypt_data = decrypt(encrypt_data, request_key);
    this.logger.log('Decrypted:', decrypt_data);
  }
  async getKey(requestKey: string) {
    return crypto.scryptSync(requestKey, this.salt, 32); // 32 bytes for aes-256
  }
}
