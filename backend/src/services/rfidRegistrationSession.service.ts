let currentBeerId: number | null = null;

export const getCurrentRegistrationBeerId = (): number | null => currentBeerId;

export const setCurrentRegistrationBeerId = (beerId: number): void => {
  currentBeerId = beerId;
};

export const clearCurrentRegistrationBeerId = (): void => {
  currentBeerId = null;
};
