import { ALERT_STATUS } from '../components/Importer/validation/importAlert';
import globalMessageIds from 'core/i18n/globalMessageIds';
import { checkAllValuesAreZero, checkEmptyObj } from '../utils/getOrgsStates';

import { FakeDataType } from '../components/Importer/validation';
import { NATIVE_PERSON_FIELDS } from 'features/views/components/types';
import useCustomFields from 'features/profile/hooks/useCustomFields';

import messageIds from '../l10n/messageIds';
import { useMessages } from 'core/i18n';

interface useAlertsStatesReturn {
  alertStatus: ALERT_STATUS;
  msg: string;
  title: string;
}

export default function useAlertsStates(
  fake: FakeDataType['summary'],
  orgId: number
): useAlertsStatesReturn[] {
  const message = useMessages(messageIds);
  const globalMessages = useMessages(globalMessageIds);
  const nativeFields = Object.values(NATIVE_PERSON_FIELDS) as string[];
  const customFields = useCustomFields(orgId).data ?? [];

  const result = [];

  const fieldsWithManyChanges = Object.entries(fake.peopleUpdated.byField)
    .filter((item) => {
      const fieldValue = item[1] as number;
      return fake.peopleUpdated.total * 0.2 < fieldValue;
    })
    .map((item) => item[0]);

  //Error when no one imported
  if (checkEmptyObj(fake) || checkAllValuesAreZero(fake)) {
    result.push({
      alertStatus: ALERT_STATUS.ERROR,
      msg: message.validation.alerts.error.desc(),
      title: message.validation.alerts.error.title(),
    });
  }
  //Warning when there are many changes to field
  else if (fieldsWithManyChanges.length > 0) {
    fieldsWithManyChanges.forEach((key) =>
      result.push({
        alertStatus: ALERT_STATUS.WARNING,
        msg: message.validation.alerts.warning.manyChanges.desc(),
        title: message.validation.alerts.warning.manyChanges.title({
          fieldName: nativeFields.includes(key)
            ? globalMessages.personFields[key as NATIVE_PERSON_FIELDS]()
            : customFields.find((item) => item.slug === key)?.title ?? '',
        }),
      })
    );
  } else {
    result.push({
      alertStatus: ALERT_STATUS.INFO,
      msg: message.validation.alerts.info.desc(),
      title: message.validation.alerts.info.title(),
    });
  }
  return result;
}
