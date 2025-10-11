const { clsx } = require("clsx");
const { twMerge } = require("tailwind-merge");
const axios = require('axios');

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const getErrorMessage = (error) => {
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

module.exports = { cn, getErrorMessage };
