export const ROWVERSION_TOKEN = /^0x[0-9a-f]{16}$/i;

function bytesFrom(value) {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.length === 8 ? Buffer.from(value) : null;
    if (value?.type === "Buffer" && Array.isArray(value.data)
        && value.data.length === 8 && value.data.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        return Buffer.from(value.data);
    }
    // Some SQL driver paths expose binary(8) as a JavaScript binary string.
    // Preserve each code unit as one byte; UTF-8 conversion would corrupt bytes above 0x7f.
    if (typeof value === "string" && value.length === 8
        && [...value].every(character => character.charCodeAt(0) <= 255)) {
        return Buffer.from([...value].map(character => character.charCodeAt(0)));
    }
    return null;
}

export function serializeRecapRowVersion(value) {
    if (typeof value === "string" && ROWVERSION_TOKEN.test(value.trim())) return `0x${value.trim().slice(2).toUpperCase()}`;
    const bytes = bytesFrom(value);
    return bytes ? `0x${bytes.toString("hex").toUpperCase()}` : value;
}
