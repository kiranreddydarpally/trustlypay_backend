import { Role } from 'src/enums/role.enum';

export interface IUser {
  id: number;
  email: string;
  password: string;
  createdAt: Date;
  role: Role;
}
