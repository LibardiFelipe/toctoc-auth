const BLOCKED_KEYS = ["__proto__", "constructor", "prototype"];

const nameOf = (fn: Function): string | undefined => {
  const fnString = fn.toString();
  if (fnString.includes(".")) {
    const splitFn = fnString.split(".");
    const propertyName = splitFn[splitFn.length - 1]
      .trim()
      .replace(" ", "")
      .replace(";", "")
      .replace("}", "")
      .replace("{", "");
    return propertyName;
  }

  return undefined;
};

const hasNestedProperty = (obj: any, path: string[]): boolean => {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  let current = obj;
  for (const key of path) {
    // Block prototype chain traversal
    if (BLOCKED_KEYS.includes(key)) {
      return false;
    }

    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return false;
    }
    current = current[key];
  }
  return true;
};

const getNestedProperty = <T>(obj: any, path: string[]): T | undefined => {
  if (path.length === 0 || !obj || typeof obj !== "object") {
    return undefined;
  }

  let current = obj;
  for (const key of path) {
    // Block prototype chain traversal
    if (BLOCKED_KEYS.includes(key)) {
      return undefined;
    }

    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current as T;
};

const areStringArraysEquivalent = (arrayOne: string[], arrayTwo: string[]) => {
  const string1 = arrayOne.join("");
  const string2 = arrayTwo.join("");
  return string1 === string2;
};

export const utils = {
  nameOf,
  hasNestedProperty,
  getNestedProperty,
  areStringArraysEquivalent,
};
