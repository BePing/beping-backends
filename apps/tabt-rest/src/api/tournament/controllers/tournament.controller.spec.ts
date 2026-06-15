import { Test, TestingModule } from '@nestjs/testing';
import { TournamentController } from './tournament.controller';
import { TournamentService } from '../../../services/tournaments/tournament.service';
import {
  GetTournamentDetails,
  RegisterTournament,
} from '../dto/tournaments.dto';
import { NotFoundException } from '@nestjs/common';

jest.mock('../../../services/tournaments/tournament.service');

describe('TournamentController', () => {
  let controller: TournamentController;
  let tournamentService: TournamentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TournamentController],
      providers: [TournamentService],
    }).compile();

    controller = module.get<TournamentController>(TournamentController);
    tournamentService = module.get<TournamentService>(TournamentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Tournaments', () => {
    it('should call tournaments service with correct params', async () => {
      const spy = jest.spyOn(tournamentService, 'getTournaments');
      const result = await controller.findAllV1();

      expect(result).toBeDefined();
      expect(result[0]).toBeDefined();
      expect(spy).toHaveBeenCalledWith({});
    });
    it('should call tournaments service with correct params to find one tournament', async () => {
      const input: GetTournamentDetails = {
        withResults: true,
        withRegistrations: true,
      };
      const spy = jest.spyOn(tournamentService, 'getTournaments');
      const result = await controller.findByIdV1(input, 123);

      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalledWith({
        TournamentUniqueIndex: 123,
        WithRegistrations: true,
        WithResults: true,
      });
    });
    it('should throw 404 exception if not found', async () => {
      const input: GetTournamentDetails = {};
      jest.spyOn(tournamentService, 'getTournaments').mockResolvedValue([]);

      await expect(controller.findByIdV1(input, 142453)).rejects.toEqual(
        new NotFoundException(),
      );
    });
  });
  describe('Tournament series', () => {
    it('should call tournaments service with correct params to find series of one tournament', async () => {
      const spy = jest.spyOn(tournamentService, 'getTournaments');
      const result = await controller.getSeriesV1(123);

      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalledWith({
        TournamentUniqueIndex: 123,
        WithRegistrations: true,
      });
    });
    it('should throw 404 exception if not found', async () => {
      jest.spyOn(tournamentService, 'getTournaments').mockResolvedValue([]);

      await expect(controller.getSeriesV1(142453)).rejects.toEqual(
        new NotFoundException(),
      );
    });
  });

  describe('Tournament registration', () => {
    it('should call tournaments service with correct params to register', async () => {
      const input: RegisterTournament = {
        playerUniqueIndex: [20],
        unregister: true,
        notifyPlayer: true,
      };
      const spy = jest.spyOn(tournamentService, 'registerToTournament');
      const result = await controller.registerV1(input, 1, 2);

      expect(result).toBeDefined();
      expect(spy).toHaveBeenCalledWith({
        NotifyPlayer: true,
        PlayerUniqueIndex: [20],
        SerieUniqueIndex: 2,
        TournamentUniqueIndex: 1,
        Unregister: true,
      });
    });
  });
});
