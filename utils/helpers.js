const toPositiveInt = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const toValidDate = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

module.exports = {
    toPositiveInt,
    isNonEmptyString,
    toValidDate
};
