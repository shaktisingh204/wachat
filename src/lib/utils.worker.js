
'use strict';
const axios = require('axios');

const getErrorMessage = (error) => {
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
            return `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
        } catch (e) {
            return `Request failed with status ${error.response.status}: An unexpected response was received from the server.`;
        }
    }
    if (axios.isAxiosError(error) && error.request) {
        return 'No response received from server. Check network connectivity.';
    }
    if (error instanceof Error) {
        if ('cause' in error && error.cause) {
            return getErrorMessage(error.cause);
        }
        return error.message;
    }
    if (typeof error === 'object' && error !== null) {
        return JSON.stringify(error);
    }
    return String(error) || 'An unknown error occurred';
};

module.exports = { getErrorMessage };
