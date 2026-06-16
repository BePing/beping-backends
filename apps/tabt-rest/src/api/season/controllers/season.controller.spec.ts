import { Test, TestingModule } from '@nestjs/testing';
import { SeasonController } from './season.controller';
import { SeasonService } from '../../../services/seasons/season.service';

jest.mock('../../../services/seasons/season.service');

describe('SeasonController', () => {
  let controller: SeasonController;
  let service: SeasonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonController],
      providers: [SeasonService],
    }).compile();

    controller = module.get<SeasonController>(SeasonController);
    service = module.get<SeasonService>(SeasonService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll', async () => {
    const spy = jest.spyOn(service, 'getSeasons');

    const result = await controller.findAll();

    expect(result).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('findCurrentSeason', async () => {
    const spy = jest.spyOn(service, 'getCurrentSeason');

    const result = await controller.findCurrentSeason();

    expect(result).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
