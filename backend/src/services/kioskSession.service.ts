let currentUserId: number | null = null;

export const getCurrentUserId = (): number | null => currentUserId;

export const setCurrentUserId = (userId: number): void => {
  currentUserId = userId;
};

export const clearCurrentUserId = (): void => {
  currentUserId = null;
};
