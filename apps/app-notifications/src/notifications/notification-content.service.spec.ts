import {
  normalizeNotificationLocale,
  NotificationContentService,
} from './notification-content.service';

describe('NotificationContentService', () => {
  const service = new NotificationContentService();

  it.each([
    ['fr-BE', 'fr'],
    ['nl_BE', 'nl'],
    ['en', 'en'],
    ['de-DE', 'de'],
    ['unknown', 'fr'],
    [undefined, 'fr'],
  ])('normalizes locale %s to %s', (input, expected) => {
    expect(normalizeNotificationLocale(input)).toBe(expected);
  });

  it.each([
    ['fr', 'Classement mis à jour', 'Vos points passent de 454,5 à 475.'],
    ['nl', 'Klassement bijgewerkt', 'Je punten gaan van 454,5 naar 475.'],
    ['en', 'Ranking updated', 'Your points changed from 454.5 to 475.'],
    [
      'de',
      'Rangliste aktualisiert',
      'Ihre Punkte ändern sich von 454,5 auf 475.',
    ],
  ])('renders point updates in %s', (locale, title, body) => {
    expect(
      service.ranking(locale, { oldPoints: 454.5, newPoints: 475 }),
    ).toEqual({ title, body });
  });

  it('combines points and estimated-ranking updates', () => {
    expect(
      service.ranking('fr', {
        oldPoints: 454.5,
        newPoints: 475,
        oldRankingEstimation: 'B2',
        newRankingEstimation: 'B0',
      }).body,
    ).toBe(
      'Vos points passent de 454,5 à 475. Votre classement estimé passe de B2 à B0.',
    );
  });

  it.each([
    ['fr', 'De nouveaux résultats sont disponibles pour PANTH01/003.'],
    ['nl', 'Er zijn nieuwe resultaten beschikbaar voor PANTH01/003.'],
    ['en', 'New results are available for PANTH01/003.'],
    ['de', 'Für PANTH01/003 sind neue Ergebnisse verfügbar.'],
  ])('renders result updates in %s', (locale, body) => {
    expect(service.results(locale, 'PANTH01/003').body).toBe(body);
  });
});
