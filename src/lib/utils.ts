

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import axios from 'axios';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
        if(typeof error.response.data === 'string') {
             return `Request failed with status ${error.response.status}: ${error.response.data}`;
        }
        return `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }
    // Axios error without a response (e.g., network error)
    if (axios.isAxiosError(error) && error.request) {
        return 'No response received from server. Check network connectivity.';
    }
    // Standard JavaScript error
    if (error instanceof Error) {
        // Look for nested cause, which might hold the original error
        if ('cause' in error && error.cause) {
            return getErrorMessage(error.cause); // Recursively get message from cause
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



