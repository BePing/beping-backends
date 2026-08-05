import { instanceToPlain } from 'class-transformer';
import { TournamentEntryDTOV1 } from './tournament.dto';
import { TournamentEntry } from '../../../entity/tabt-soap/TabTAPI_Port';
import { LevelDTO } from '../../../common/dto/levels.dto';
import { Level } from '../../../entity/tabt-input.interface';

describe('TournamentEntryDTOV1', () => {
  const makeTournament = (level: number): TournamentEntry =>
    new TournamentEntry({
      UniqueIndex: 7384,
      Name: 'Critérium B - Limal-Wavre',
      Level: level,
      ExternalIndex: 'TRBBW009-2627',
    });

  it('maps the TabT level to the level DTO', () => {
    const dto = TournamentEntryDTOV1.fromTabT(makeTournament(Level.HAINAUT));
    expect(dto.level).toEqual(LevelDTO.HAINAUT);
  });

  it('keeps the mapped level after class-transformer serialization', () => {
    // Regression: a @Transform on `level` used to re-map the already-mapped
    // enum string, falling through to the default REGION_VTTL for every
    // tournament.
    const dto = TournamentEntryDTOV1.fromTabT(
      makeTournament(Level.BRUSSELS_BRABANT_WALLON),
    );
    const plain = instanceToPlain(dto);
    expect(plain.level).toEqual(LevelDTO.BRUSSELS);
    expect(plain.level).not.toEqual(LevelDTO.REGIONAL);
  });

  it('serializes a genuine VTTL regional tournament as REGION_VTTL', () => {
    const dto = TournamentEntryDTOV1.fromTabT(
      makeTournament(Level.REGION_VTTL),
    );
    expect(instanceToPlain(dto).level).toEqual(LevelDTO.REGIONAL);
  });
});
