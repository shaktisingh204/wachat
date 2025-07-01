import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import axios from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
        const apiError = error.response.data.error;
        let errorMessage = apiError.error_user_title ? `${apiError.error_user_title}: ${apiError.error_user_msg}` : apiError.message || 'API Error';
        if (apiError.error_data?.details) {
            errorMessage += ` Details: ${apiError.error_data.details}`;
        }
        return `${errorMessage} (Code: ${apiError.code}, Type: ${apiError.type})`;
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
    return String(error) || 'An unknown error occurred';
};
