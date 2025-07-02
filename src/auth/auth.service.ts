import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(user: LoginDto) {
    const payload = { username: user.username };
    console.log(' access_token: this.jwtService.sign(payload)', payload);
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
