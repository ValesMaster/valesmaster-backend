export const parseId = (value: string | string[] | undefined): number | null => {
    const raw = Array.isArray(value) ? value[0] : value;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
};

export const parsePagination = (page: unknown, limit: unknown) => {
    const pageNumber = Math.max(1, parseInt(String(page ?? '1'), 10) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(String(limit ?? '10'), 10) || 10));
    const skip = (pageNumber - 1) * limitNumber;

    return { pageNumber, limitNumber, skip };
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: unknown): boolean => {
    return typeof value === 'string' && EMAIL_REGEX.test(value);
};
