import { ValidateIf, type ValidationOptions } from 'class-validator';

/**
 * Allows the decorated property to be `null`.
 *
 * @param options Validation options.
 */
export function IsNullable(options?: ValidationOptions): PropertyDecorator {
  return function IsNullableDecorator(
    prototype: object,
    propertyKey: string | symbol,
  ) {
    ValidateIf((obj) => obj[propertyKey] !== null, options)(
      prototype,
      propertyKey,
    );
  };
}
