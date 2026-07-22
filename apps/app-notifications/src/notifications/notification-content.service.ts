import { Injectable } from '@nestjs/common';

export type NotificationLocale = 'fr' | 'nl' | 'en' | 'de';

export interface RankingNotificationPayload {
  oldPoints?: number | null;
  newPoints?: number | null;
  oldNumericRanking?: number | null;
  newNumericRanking?: number | null;
  oldRankingEstimation?: string | null;
  newRankingEstimation?: string | null;
}

export interface NotificationContent {
  title: string;
  body: string;
}

export function normalizeNotificationLocale(
  locale?: string,
): NotificationLocale {
  const language = (locale || '').trim().toLowerCase().split(/[-_]/)[0];
  return language === 'nl' || language === 'en' || language === 'de'
    ? language
    : 'fr';
}

@Injectable()
export class NotificationContentService {
  ranking(
    locale: string,
    payload: RankingNotificationPayload,
  ): NotificationContent {
    const language = normalizeNotificationLocale(locale);
    const pointsChanged =
      payload.oldPoints != null &&
      payload.newPoints != null &&
      payload.oldPoints !== payload.newPoints;
    const estimationChanged =
      payload.newRankingEstimation != null &&
      payload.oldRankingEstimation !== payload.newRankingEstimation;
    const numericRankingChanged =
      payload.oldNumericRanking != null &&
      payload.newNumericRanking != null &&
      payload.oldNumericRanking !== payload.newNumericRanking;

    const points = pointsChanged
      ? this.formatPointsChange(
          language,
          payload.oldPoints as number,
          payload.newPoints as number,
        )
      : null;
    const estimation = estimationChanged
      ? this.formatEstimationChange(
          language,
          payload.oldRankingEstimation,
          payload.newRankingEstimation as string,
        )
      : null;
    const numericRanking = numericRankingChanged
      ? this.formatNumericRankingChange(
          language,
          payload.oldNumericRanking as number,
          payload.newNumericRanking as number,
        )
      : null;

    const bodies = [points, estimation, numericRanking].filter(
      (part): part is string => Boolean(part),
    );

    return {
      title: {
        fr: 'Classement mis à jour',
        nl: 'Klassement bijgewerkt',
        en: 'Ranking updated',
        de: 'Rangliste aktualisiert',
      }[language],
      body:
        bodies.join(' ') ||
        {
          fr: 'Votre classement a été mis à jour.',
          nl: 'Je klassement werd bijgewerkt.',
          en: 'Your ranking has been updated.',
          de: 'Ihre Rangliste wurde aktualisiert.',
        }[language],
    };
  }

  results(locale: string, competitionName: string): NotificationContent {
    const language = normalizeNotificationLocale(locale);
    const name = competitionName.trim();

    return {
      title: {
        fr: 'Nouveaux résultats',
        nl: 'Nieuwe resultaten',
        en: 'New results',
        de: 'Neue Ergebnisse',
      }[language],
      body: {
        fr: `De nouveaux résultats sont disponibles pour ${name}.`,
        nl: `Er zijn nieuwe resultaten beschikbaar voor ${name}.`,
        en: `New results are available for ${name}.`,
        de: `Für ${name} sind neue Ergebnisse verfügbar.`,
      }[language],
    };
  }

  private formatPointsChange(
    locale: NotificationLocale,
    oldPoints: number,
    newPoints: number,
  ): string {
    const intlLocale = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB', de: 'de-BE' }[
      locale
    ];
    const formatter = new Intl.NumberFormat(intlLocale, {
      maximumFractionDigits: 2,
    });
    const oldValue = formatter.format(oldPoints);
    const newValue = formatter.format(newPoints);

    return {
      fr: `Vos points passent de ${oldValue} à ${newValue}.`,
      nl: `Je punten gaan van ${oldValue} naar ${newValue}.`,
      en: `Your points changed from ${oldValue} to ${newValue}.`,
      de: `Ihre Punkte ändern sich von ${oldValue} auf ${newValue}.`,
    }[locale];
  }

  private formatEstimationChange(
    locale: NotificationLocale,
    oldEstimation: string | null | undefined,
    newEstimation: string,
  ): string {
    if (!oldEstimation) {
      return {
        fr: `Votre classement estimé est ${newEstimation}.`,
        nl: `Je geschatte klassement is ${newEstimation}.`,
        en: `Your estimated ranking is ${newEstimation}.`,
        de: `Ihre geschätzte Einstufung ist ${newEstimation}.`,
      }[locale];
    }

    return {
      fr: `Votre classement estimé passe de ${oldEstimation} à ${newEstimation}.`,
      nl: `Je geschatte klassement gaat van ${oldEstimation} naar ${newEstimation}.`,
      en: `Your estimated ranking changed from ${oldEstimation} to ${newEstimation}.`,
      de: `Ihre geschätzte Einstufung ändert sich von ${oldEstimation} auf ${newEstimation}.`,
    }[locale];
  }

  private formatNumericRankingChange(
    locale: NotificationLocale,
    oldRanking: number,
    newRanking: number,
  ): string {
    return {
      fr: `Votre position passe de ${oldRanking} à ${newRanking}.`,
      nl: `Je positie gaat van ${oldRanking} naar ${newRanking}.`,
      en: `Your position changed from ${oldRanking} to ${newRanking}.`,
      de: `Ihre Position ändert sich von ${oldRanking} auf ${newRanking}.`,
    }[locale];
  }
}
