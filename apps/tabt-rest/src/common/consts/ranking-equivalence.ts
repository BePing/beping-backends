export const MEN_RANKING_EQUIVALENTS = {
  ranking_equivalents_men: [
    { rank: 'A', gap: 20, points_range: '1-20' },
    { rank: 'B0', gap: 55, points_range: '21-75' },
    { rank: 'B2', gap: 150, points_range: '76-225' },
    { rank: 'B4', gap: 250, points_range: '226-475' },
    { rank: 'B6', gap: 425, points_range: '476-900' },
    { rank: 'C0', gap: 550, points_range: '901-1450' },
    { rank: 'C2', gap: 750, points_range: '1451-2200' },
    { rank: 'C4', gap: 900, points_range: '2201-3100' },
    { rank: 'C6', gap: 950, points_range: '3101-4050' },
    { rank: 'D0', gap: 1050, points_range: '4051-5100' },
    { rank: 'D2', gap: 1050, points_range: '5101-6150' },
    { rank: 'D4', gap: 1150, points_range: '6151-7300' },
    { rank: 'D6', gap: 1150, points_range: '7301-8450' },
    { rank: 'E0', gap: 1250, points_range: '8451-9700' },
    { rank: 'E2', gap: 1750, points_range: '9701-11450' },
    { rank: 'E4', gap: 2000, points_range: '11451-13450' },
    { rank: 'E6', gap: 2500, points_range: '13451-15950' },
    { rank: 'NC', gap: 'Remaining', points_range: '15951+' },
  ],
};
// todo: add women ranking equivalents
export const WOMEN_RANKING_EQUIVALENTS = {
  ranking_equivalents_women: [
    { rank: 'A', gap: 20, points_range: '1-20' },
    { rank: 'B0', gap: 55, points_range: '21-75' },
    { rank: 'B2', gap: 150, points_range: '76-225' },
  ],
};
export const MEN_POINTS_DIFFERENCE_TABLE = {
  difference_of_points_table: [
    {
      point_difference: '0-25',
      expected_result_points: 9,
      unexpected_result_points: 10,
    },
    {
      point_difference: '26-50',
      expected_result_points: 8,
      unexpected_result_points: 12,
    },
    {
      point_difference: '51-75',
      expected_result_points: 7,
      unexpected_result_points: 14,
    },
    {
      point_difference: '76-100',
      expected_result_points: 6,
      unexpected_result_points: 16,
    },
    {
      point_difference: '101-150',
      expected_result_points: 5,
      unexpected_result_points: 18,
    },
    {
      point_difference: '151-200',
      expected_result_points: 4,
      unexpected_result_points: 20,
    },
    {
      point_difference: '201-250',
      expected_result_points: 3,
      unexpected_result_points: 24,
    },
    {
      point_difference: '251-300',
      expected_result_points: 2,
      unexpected_result_points: 28,
    },
    {
      point_difference: '301-400',
      expected_result_points: 1,
      unexpected_result_points: 32,
    },
    {
      point_difference: '401+',
      expected_result_points: 0,
      unexpected_result_points: 40,
    },
  ],
};
// todo: add women points difference table
export const WOMEN_POINTS_DIFFERENCE_TABLE = {
  difference_of_points_table: [],
};
export const MEN_INTERCLUB_COEFFICIENTS = [
  {
    coefficient: 'R2',
    value: 2.2,
    competitions: ['SuperDivision'],
  },
  {
    coefficient: 'R5',
    value: 1.0,
    competitions: ['N1 & N2'],
  },
  {
    coefficient: 'R6',
    value: 0.95,
    competitions: ['N3', 'IWB', 'Landelĳk'],
  },
  {
    coefficient: 'R7',
    value: 0.9,
    competitions: ['P1'],
  },
  {
    coefficient: 'R8',
    value: 0.85,
    competitions: ['Other Provincial Competitions'],
  },
];

// todo: add women interclub coefficients
export const WOMEN_INTERCLUB_COEFFICIENTS = [];
