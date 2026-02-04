
export interface ISmsProvider {
    /**
     * Send a single SMS.
     * @param to Recipient phone number (E.164 format preferred)
     * @param content The actual message content (variables already interpolated)
     * @param dltParams DLT specific parameters required by Indian regulations
     * @returns Promise resolving to the Provider's Message ID
     */
    send(
        to: string,
        content: string,
        dltParams: {
            dltTemplateId: string;
            dltPrincipalEntityId: string;
            dltHeaderId: string;
        }
    ): Promise<{ messageId: string, status: 'SENT' | 'FAILED' | 'QUEUED', error?: string }>;

    /**
     * Check account balance (if supported API exists)
     */
    getBalance?(): Promise<number>;
}
