import { PlayerCategory } from '../../entity/tabt-input.interface';

export enum PlayerCategoryDTO {
  SENIOR_MEN = 'SEN_M',
  SENIOR_WOMEN = 'SEN_W',
  YOUTH = 'YOU_M',
  YOUTH_WOMEN = 'YOU_W',
  VETERAN = 'VET_M',
  SENIOR = 'VET_W',
  BENJAMINS = 'BEN_M',
  BENJAMINES = 'BEN_W',
  PREMINIMES = 'PRE_M',
  PREMINIMES_WOMEN = 'PRE_W',
  MINIMES = 'MIN_M',
  MINIMES_WOMEN = 'MIN_W',
  CADETS = 'CAD_M',
  CADETTES = 'CAD_W',
  JUNIORS = 'JUN_M',
  JUNIORS_WOMEN = 'JUN_W',
  YOUTH_19 = 'J19_M',
  YOUTH_19_WOMEN = 'J19_W',
  VETERAN_40 = 'V40_M',
  SENIOR_40 = 'V40_W',
  VETERAN_50 = 'V50_M',
  SENIOR_50 = 'V50_W',
  VETERAN_60 = 'V60_M',
  SENIOR_60 = 'V60_W',
  VETERAN_65 = 'V65_M',
  SENIOR_65 = 'V65_W',
  VETERAN_70 = 'V70_M',
  SENIOR_70 = 'V70_W',
  VETERAN_75 = 'V75_M',
  SENIOR_75 = 'V75_W',
  VETERAN_80 = 'V80_M',
  SENIOR_80 = 'V80_W',
  VETERAN_85 = 'V85_M',
  SENIOR_85 = 'V85_W',
}

export const playerCategoryDisplayNames: Record<PlayerCategoryDTO, string> = {
  [PlayerCategoryDTO.SENIOR_MEN]: 'Seniors Heren',
  [PlayerCategoryDTO.SENIOR_WOMEN]: 'Seniors Dames',
  [PlayerCategoryDTO.YOUTH]: 'Jeugd',
  [PlayerCategoryDTO.YOUTH_WOMEN]: 'Jeugd Meisjes',
  [PlayerCategoryDTO.VETERAN]: 'Veteranen',
  [PlayerCategoryDTO.SENIOR]: 'Dames Veteranen',
  [PlayerCategoryDTO.BENJAMINS]: 'Benjamins',
  [PlayerCategoryDTO.BENJAMINES]: 'Benjamines',
  [PlayerCategoryDTO.PREMINIMES]: 'Pre-miniemen',
  [PlayerCategoryDTO.PREMINIMES_WOMEN]: 'Pre-miniemen meisjes',
  [PlayerCategoryDTO.MINIMES]: 'Miniemen',
  [PlayerCategoryDTO.MINIMES_WOMEN]: 'Miniemen meisjes',
  [PlayerCategoryDTO.CADETS]: 'Cadetten',
  [PlayerCategoryDTO.CADETTES]: 'Cadetten meisjes',
  [PlayerCategoryDTO.JUNIORS]: 'Juniors',
  [PlayerCategoryDTO.JUNIORS_WOMEN]: 'Juniors meisjes',
  [PlayerCategoryDTO.YOUTH_19]: 'Jeugd -19',
  [PlayerCategoryDTO.YOUTH_19_WOMEN]: 'Jeugd -19 meisjes',
  [PlayerCategoryDTO.VETERAN_40]: 'Veteranen 40',
  [PlayerCategoryDTO.SENIOR_40]: 'Veteranen Dames 40',
  [PlayerCategoryDTO.VETERAN_50]: 'Veteranen 50',
  [PlayerCategoryDTO.SENIOR_50]: 'Veteranen Dames 50',
  [PlayerCategoryDTO.VETERAN_60]: 'Veteranen 60',
  [PlayerCategoryDTO.SENIOR_60]: 'Veteranen Dames 60',
  [PlayerCategoryDTO.VETERAN_65]: 'Veteranen 65',
  [PlayerCategoryDTO.SENIOR_65]: 'Veteranen Dames 65',
  [PlayerCategoryDTO.VETERAN_70]: 'Veteranen 70',
  [PlayerCategoryDTO.SENIOR_70]: 'Veteranen Dames 70',
  [PlayerCategoryDTO.VETERAN_75]: 'Veteranen 75',
  [PlayerCategoryDTO.SENIOR_75]: 'Veteranen Dames 75',
  [PlayerCategoryDTO.VETERAN_80]: 'Veteranen 80',
  [PlayerCategoryDTO.SENIOR_80]: 'Veteranen Dames 80',
  [PlayerCategoryDTO.VETERAN_85]: 'Veteranen 85',
  [PlayerCategoryDTO.SENIOR_85]: 'Veteranen Dames 85',
};

export const playerCategoryDTOToPlayerCategory: Record<
  PlayerCategoryDTO,
  PlayerCategory
> = {
  [PlayerCategoryDTO.SENIOR_MEN]: PlayerCategory.SENIOR_MEN,
  [PlayerCategoryDTO.SENIOR_WOMEN]: PlayerCategory.SENIOR_WOMEN,
  [PlayerCategoryDTO.YOUTH]: PlayerCategory.YOUTH,
  [PlayerCategoryDTO.YOUTH_WOMEN]: PlayerCategory.YOUTH_WOMEN,
  [PlayerCategoryDTO.VETERAN]: PlayerCategory.VETERANS,
  [PlayerCategoryDTO.SENIOR]: PlayerCategory.SENIOR,
  [PlayerCategoryDTO.BENJAMINS]: PlayerCategory.BENJAMINS,
  [PlayerCategoryDTO.BENJAMINES]: PlayerCategory.BENJAMINES,
  [PlayerCategoryDTO.PREMINIMES]: PlayerCategory.PREMINIMES,
  [PlayerCategoryDTO.PREMINIMES_WOMEN]: PlayerCategory.PREMINIMES_WOMEN,
  [PlayerCategoryDTO.MINIMES]: PlayerCategory.MINIMES,
  [PlayerCategoryDTO.MINIMES_WOMEN]: PlayerCategory.MINIMES_WOMEN,
  [PlayerCategoryDTO.CADETS]: PlayerCategory.CADETS,
  [PlayerCategoryDTO.CADETTES]: PlayerCategory.CADETTES,
  [PlayerCategoryDTO.JUNIORS]: PlayerCategory.JUNIORS,
  [PlayerCategoryDTO.JUNIORS_WOMEN]: PlayerCategory.JUNIORS_WOMEN,
  [PlayerCategoryDTO.YOUTH_19]: PlayerCategory.YOUTH_19,
  [PlayerCategoryDTO.YOUTH_19_WOMEN]: PlayerCategory.YOUTH_19_WOMEN,
  [PlayerCategoryDTO.VETERAN_40]: PlayerCategory.VETERANS_40,
  [PlayerCategoryDTO.SENIOR_40]: PlayerCategory.SENIOR_40,
  [PlayerCategoryDTO.VETERAN_50]: PlayerCategory.VETERANS_50,
  [PlayerCategoryDTO.SENIOR_50]: PlayerCategory.SENIOR_50,
  [PlayerCategoryDTO.VETERAN_60]: PlayerCategory.VETERANS_60,
  [PlayerCategoryDTO.SENIOR_60]: PlayerCategory.SENIOR_60,
  [PlayerCategoryDTO.VETERAN_65]: PlayerCategory.VETERANS_65,
  [PlayerCategoryDTO.SENIOR_65]: PlayerCategory.SENIOR_65,
  [PlayerCategoryDTO.VETERAN_70]: PlayerCategory.VETERANS_70,
  [PlayerCategoryDTO.SENIOR_70]: PlayerCategory.SENIOR_70,
  [PlayerCategoryDTO.VETERAN_75]: PlayerCategory.VETERANS_75,
  [PlayerCategoryDTO.SENIOR_75]: PlayerCategory.SENIOR_75,
  [PlayerCategoryDTO.VETERAN_80]: PlayerCategory.VETERANS_80,
  [PlayerCategoryDTO.SENIOR_80]: PlayerCategory.SENIOR_80,
  [PlayerCategoryDTO.VETERAN_85]: PlayerCategory.VETERANS_85,
  [PlayerCategoryDTO.SENIOR_85]: PlayerCategory.SENIOR_85,
};

export const playerCategoryToPlayerCategoryDTO: Record<
  PlayerCategory,
  PlayerCategoryDTO
> = Object.fromEntries(
  Object.entries(playerCategoryDTOToPlayerCategory).map(([dto, category]) => [
    category,
    dto as PlayerCategoryDTO,
  ]),
) as Record<PlayerCategory, PlayerCategoryDTO>;

export function mapPlayerCategoryToPlayerCategoryDTO(
  playerCategory: PlayerCategory,
): PlayerCategoryDTO {
  return playerCategoryToPlayerCategoryDTO[playerCategory];
}

export function mapPlayerCategoryDTOToPlayerCategory(
  playerCategoryDTO: PlayerCategoryDTO,
): PlayerCategory {
  return playerCategoryDTOToPlayerCategory[playerCategoryDTO];
}
