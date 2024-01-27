import { Test, TestingModule } from '@nestjs/testing';
import { KiitUsersService } from './kiit-users.service';

describe('KiitUsersService', () => {
  let service: KiitUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KiitUsersService],
    }).compile();

    service = module.get<KiitUsersService>(KiitUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
