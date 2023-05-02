import { ValidatorOptions } from 'class-validator';

/**
 * The validator options to use when parsing unknown inputs.
 */
export const validatorOptions: ValidatorOptions = {
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  whitelist: true,
  skipUndefinedProperties: false,
  skipNullProperties: false,
};
