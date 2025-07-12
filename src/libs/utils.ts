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
  let current = obj;
  for (const key of path) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return false;
    }
    current = current[key];
  }
  return true;
};

const getNestedProperty = <T>(obj: any, path: string[]): T | undefined => {
  if (path.length === 0) {
    return undefined;
  }

  let current = obj;
  for (const key of path) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current;
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
