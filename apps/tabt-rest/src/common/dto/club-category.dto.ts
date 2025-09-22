import { ClubCategory } from '../../entity/tabt-input.interface';

export enum ClubCategoryDTO {
  VLAAMS_BRABANT_BR = 'VLAAMS_BRABANT_BR',
  BRUSSELS_BRABANT_WALLON = 'BRUSSELS_BRABANT_WALLON',
  ANTWERP = 'ANTWERP',
  OOST_VLANDEREN = 'OOST_VLANDEREN',
  WEST_VLAANDEREN = 'WEST_VLAANDEREN',
  LIMBURG = 'LIMBURG',
  HAINAUT = 'HAINAUT',
  LUXEMBOURG = 'LUXEMBOURG',
  LIEGE = 'LIEGE',
  NAMUR = 'NAMUR',
  VTTL = 'VTTL',
  AFTT = 'AFTT',
  FRBTT = 'FRBTT',
}

export function mapClubCategoryDTOToClubCategory(
  clubCategoryDTO: ClubCategoryDTO,
): ClubCategory {
  return ClubCategory[clubCategoryDTO];
}

export function mapClubCategoryToClubCategoryDTO(
  clubCategory: ClubCategory,
): ClubCategoryDTO {
  return ClubCategoryDTO[clubCategory];
}
