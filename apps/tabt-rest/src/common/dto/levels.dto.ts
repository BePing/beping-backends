import { Level } from '../../entity/tabt-input.interface';

export enum LevelDTO {
  // National levels
  SUPER = 'SUPER_DIVISION', // Level.SUPER_DIVISION
  NATIONAL = 'NATIONAL', // Level.NATIONAL

  // Regional level
  REGIONAL = 'REGION_VTTL', // Level.REGION_VTTL

  // Flanders provinces
  ANTWERP = 'ANTWERP', // Level.ANTWERP
  LIMBURG = 'LIMBURG', // Level.LIMBURG
  EAST_FLANDERS = 'OOST_VLANDEREN', // Level.OOST_VLANDEREN
  WEST_FLANDERS = 'WEST_VLAANDEREN', // Level.WEST_VLAANDEREN
  FLEMISH_BRABANT = 'VLAAMS_BRABANT_BR', // Level.VLAAMS_BRABANT_BR

  // Wallonia provinces
  HAINAUT = 'HAINAUT', // Level.HAINAUT
  LIEGE = 'LIEGE', // Level.LIEGE
  LUXEMBOURG = 'LUXEMBOURG', // Level.LUXEMBOURG
  NAMUR = 'NAMUR', // Level.NAMUR
  WALLOON_BRABANT = 'BRUSSELS_BRABANT_WALLON', // Part of Level.BRUSSELS_BRABANT_WALLON

  // Brussels
  BRUSSELS = 'BRUSSELS', // Part of Level.BRUSSELS_BRABANT_WALLON

  // Special
  IWB = 'IWB', // Level.IWB
}

// Helper function to map LevelDTO to Level numbers
export function mapLevelDTOToLevels(levelDTO: LevelDTO): number[] {
  switch (levelDTO) {
    // National levels
    case LevelDTO.SUPER:
      return [Level.SUPER_DIVISION];
    case LevelDTO.NATIONAL:
      return [Level.NATIONAL];

    // Regional level
    case LevelDTO.REGIONAL:
      return [Level.REGION_VTTL];

    // Flanders provinces
    case LevelDTO.ANTWERP:
      return [Level.ANTWERP];
    case LevelDTO.LIMBURG:
      return [Level.LIMBURG];
    case LevelDTO.EAST_FLANDERS:
      return [Level.OOST_VLANDEREN];
    case LevelDTO.WEST_FLANDERS:
      return [Level.WEST_VLAANDEREN];
    case LevelDTO.FLEMISH_BRABANT:
      return [Level.VLAAMS_BRABANT_BR];

    // Wallonia provinces
    case LevelDTO.HAINAUT:
      return [Level.HAINAUT];
    case LevelDTO.LIEGE:
      return [Level.LIEGE];
    case LevelDTO.LUXEMBOURG:
      return [Level.LUXEMBOURG];
    case LevelDTO.NAMUR:
      return [Level.NAMUR];
    case LevelDTO.WALLOON_BRABANT:
    case LevelDTO.BRUSSELS:
      return [Level.BRUSSELS_BRABANT_WALLON];

    // Special
    case LevelDTO.IWB:
      return [Level.IWB];

    default:
      return [];
  }
}

export function mapLevelToLevelDTO(level: number): LevelDTO {
  switch (level) {
    case Level.SUPER_DIVISION:
      return LevelDTO.SUPER;
    case Level.NATIONAL:
      return LevelDTO.NATIONAL;
    case Level.REGION_VTTL:
      return LevelDTO.REGIONAL;
    case Level.ANTWERP:
      return LevelDTO.ANTWERP;
    case Level.LIMBURG:
      return LevelDTO.LIMBURG;
    case Level.OOST_VLANDEREN:
      return LevelDTO.EAST_FLANDERS;
    case Level.WEST_VLAANDEREN:
      return LevelDTO.WEST_FLANDERS;
    case Level.VLAAMS_BRABANT_BR:
      return LevelDTO.FLEMISH_BRABANT;
    case Level.HAINAUT:
      return LevelDTO.HAINAUT;
    case Level.LIEGE:
      return LevelDTO.LIEGE;
    case Level.LUXEMBOURG:
      return LevelDTO.LUXEMBOURG;
    case Level.NAMUR:
      return LevelDTO.NAMUR;
    case Level.BRUSSELS_BRABANT_WALLON:
      return LevelDTO.BRUSSELS;
    case Level.IWB:
      return LevelDTO.IWB;
    default:
      return LevelDTO.REGIONAL;
  }
}

// Optional: Helper function to get all levels for a region
export function getRegionalLevels(
  region: 'FLANDERS' | 'WALLONIA' | 'ALL',
): LevelDTO[] {
  switch (region) {
    case 'FLANDERS':
      return [
        LevelDTO.ANTWERP,
        LevelDTO.LIMBURG,
        LevelDTO.EAST_FLANDERS,
        LevelDTO.WEST_FLANDERS,
        LevelDTO.FLEMISH_BRABANT,
      ];
    case 'WALLONIA':
      return [
        LevelDTO.HAINAUT,
        LevelDTO.LIEGE,
        LevelDTO.LUXEMBOURG,
        LevelDTO.NAMUR,
        LevelDTO.WALLOON_BRABANT,
      ];
    case 'ALL':
      return Object.values(LevelDTO);
  }
}
