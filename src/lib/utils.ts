

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import axios from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        if (apiError) {
            let errorMessage = apiError.error_user_title ? `${apiError.error_user_title}: ${apiError.error_user_msg}` : apiError.message || 'API Error';
            if (apiError.error_data?.details) {
                errorMessage += ` Details: ${apiError.error_data.details}`;
            }
            if(apiError.error_subcode) {
                errorMessage += ` (Subcode: ${apiError.error_subcode})`;
            }
            return `${errorMessage} (Code: ${apiError.code})`;
        }
        if (error.response?.data) {
             return `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
        }
        if (error.request) {
            return 'No response received from server. Check network connectivity.';
        }
    }
    if (error instanceof Error) {
        if ('cause' in error && error.cause) {
            const cause = error.cause as any;
            if (cause.error) {
                const apiError = cause.error;
                 return `${apiError.message || 'API Error'} (Code: ${apiError.code}, Type: ${apiError.type})`;
            }
             if (cause.message) {
                return cause.message;
            }
        }
        return error.message;
    }
    if (typeof error === 'object' && error !== null) {
        return JSON.stringify(error);
    }
    return String(error) || 'An unknown error occurred';
};

