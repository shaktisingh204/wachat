import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from 'axios';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const getErrorMessage = (error: any): string => {
    // Axios error with a response from the server
    if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data?.error;
        if (apiError && typeof apiError === 'object') {
            let message = apiError.error_user_title
                ? `${apiError.error_user_title}: ${apiError.error_user_msg}`
                : apiError.message || 'An unknown API error occurred.';
            if (apiError.code) {
                message += ` (Code: ${apiError.code})`
            }
            if (apiError.error_subcode) {
                message += ` (Subcode: ${apiError.error_subcode})`;
            }
            if (apiError.error_data?.details) {
                message += ` Details: ${apiError.error_data.details}`;
            }
            return message;
        }
        try {
            // Attempt to stringify JSON, which will fail for HTML and other non-JSON responses.
            return `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
        } catch (e) {
            // If stringify fails, it's likely an HTML error page or other non-JSON response.
            return `Request failed with status ${error.response.status}: An unexpected response was received from the server.`;
        }
    }
    // Axios error without a response (e.g., network error)
    if (axios.isAxiosError(error) && error.request) {
        return 'No response received from server. Check network connectivity.';
    }
    // Standard JavaScript error
    if (error instanceof Error) {
        // Look for nested cause, which might hold the original error
        if ('cause' in error && (error as any).cause) {
            return getErrorMessage((error as any).cause); // Recursively get message from cause
        }
        return error.message;
    }
    // Plain object error
    if (typeof error === 'object' && error !== null) {
        return JSON.stringify(error);
    }
    // Fallback for other types
    return String(error) || 'An unknown error occurred';
};

export const VALIDATION_MESSAGES = {
    unsupportedType: (fileName: string) => `File '${fileName}' has an unsupported file type.`,
    sizeExceeded: (fileName: string, maxSizeMB: number) => `File '${fileName}' exceeds the size limit of ${maxSizeMB}MB.`,
    noFile: "No file was uploaded.",
    invalidName: "Invalid filename.",
};

export const sanitizeFilename = (filename: string) => {
    // Replace spaces with underscores and remove characters that are not alphanumeric, underscores, hyphens, or dots.
    return filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
};

export const validateFile = (file: File, allowedTypes: string[], maxSizeMB = 5) => {
    if (!file || file.size === 0) {
        return { isValid: false, error: VALIDATION_MESSAGES.noFile };
    }

    const sanitizedName = sanitizeFilename(file.name);
    if (!sanitizedName) {
        return { isValid: false, error: VALIDATION_MESSAGES.invalidName };
    }

    const fileType = file.type;
    const fileSize = file.size;

    if (!allowedTypes.includes(fileType)) {
        return { isValid: false, error: VALIDATION_MESSAGES.unsupportedType(file.name) };
    }

    if (fileSize > maxSizeMB * 1024 * 1024) {
        return { isValid: false, error: VALIDATION_MESSAGES.sizeExceeded(file.name, maxSizeMB) };
    }

    return { isValid: true, error: null, sanitizedName };
};


export function fmtDate(v?: string | Date | number): string {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(d);
  } catch {
    return String(v);
  }
}

export function formatUTC(v?: string | Date | number, includeTime = false): string {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    if (includeTime) {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        hour12: false
      }).format(d);
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC'
    }).format(d);
  } catch {
    return String(v);
  }
}

export function fmtINR(value: number | undefined, currency: string = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function fmtQty(n?: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n);
  } catch {
    return String(n);
  }
}

export function formatPrice(amount: number, currency: string = 'INR'): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function serializeMongoDoc<T>(doc: any): T {
    if (doc === null || doc === undefined) return doc;
    if (Array.isArray(doc)) return doc.map(serializeMongoDoc) as any;
    // Next.js Server Actions support Date objects natively, but if we need strict JSON serialization,
    // we can leave Date or convert to ISO string. For now, let's convert to string to match JSON.parse(JSON.stringify()) behavior.
    if (doc instanceof Date) return doc.toISOString() as any;
    if (typeof doc === 'object') {
        if (doc.toHexString) return doc.toHexString();
        if (doc._bsontype === 'ObjectId') return doc.toString();
        const newDoc: any = {};
        for (const key in doc) {
            newDoc[key] = serializeMongoDoc(doc[key]);
        }
        return newDoc;
    }
    return doc;
}
