import { Transform } from 'class-transformer';

// PORT-NOTE: MeterDriver enum from twenty-server metrics module is not available
// in SabNode. We define a local mirror of the enum values here.
export enum MeterDriver {
  OpenTelemetry = 'OpenTelemetry',
  Console = 'Console',
}

export const CastToMeterDriverArray = () =>
  Transform(({ value }: { value: string }) => toMeterDriverArray(value));

const toMeterDriverArray = (value: string | undefined): MeterDriver[] | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    const rawMeterDrivers = value.split(',').map((driver) => driver.trim());
    const isInvalid = rawMeterDrivers.some(
      (driver) => !Object.values(MeterDriver).includes(driver as MeterDriver),
    );

    if (!isInvalid) {
      return rawMeterDrivers as MeterDriver[];
    }
  }

  return undefined;
};

export { toMeterDriverArray as castToMeterDriverArray };
