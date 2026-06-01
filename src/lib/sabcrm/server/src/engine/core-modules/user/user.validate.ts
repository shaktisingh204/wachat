import { type UserDocument } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.entity";
import {
  UserException,
  UserExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/user.exception";

const assertIsDefinedOrThrow = (
  user: UserDocument | undefined | null,
  exceptionToThrow: Error = new UserException(
    "UserEntity not found",
    UserExceptionCode.USER_NOT_FOUND
  )
): asserts user is UserDocument => {
  if (user === undefined || user === null) {
    throw exceptionToThrow;
  }
};

const isUserDefined = (
  user: UserDocument | undefined | null
): user is UserDocument => {
  return user !== undefined && user !== null;
};

export const userValidator: {
  assertIsDefinedOrThrow: typeof assertIsDefinedOrThrow;
  isDefined: typeof isUserDefined;
} = {
  assertIsDefinedOrThrow,
  isDefined: isUserDefined,
};
