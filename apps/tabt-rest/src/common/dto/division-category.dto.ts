import { DivisionCategory } from '../../entity/tabt-soap/TabTAPI_Port';

export enum DivisionCategoryDTO {
  SENIOR_MEN = 'SEN_M',
  SENIOR_WOMEN = 'SEN_W',
  YOUTH = 'YOU_M',
  YOUTH_WOMEN = 'YOU_W',
}

export const divisionCategoryDTOToDivisionCategory: Record<
  DivisionCategoryDTO,
  DivisionCategory
> = {
  [DivisionCategoryDTO.SENIOR_MEN]: DivisionCategory.SENIOR_MEN,
  [DivisionCategoryDTO.SENIOR_WOMEN]: DivisionCategory.SENIOR_WOMEN,
  [DivisionCategoryDTO.YOUTH]: DivisionCategory.YOUTH,
  [DivisionCategoryDTO.YOUTH_WOMEN]: DivisionCategory.YOUTH_WOMEN,
};

export function mapDivisionCategoryToDivisionCategoryDTO(
  divisionCategory: DivisionCategory,
): DivisionCategoryDTO {
  return Object.keys(divisionCategoryDTOToDivisionCategory).find(
    (key) =>
      divisionCategoryDTOToDivisionCategory[key as DivisionCategoryDTO] ===
      divisionCategory,
  ) as DivisionCategoryDTO;
}

export function mapDivisionCategoryDTOToDivisionCategory(
  divisionCategoryDTO: DivisionCategoryDTO,
): DivisionCategory {
  return divisionCategoryDTOToDivisionCategory[divisionCategoryDTO];
}
