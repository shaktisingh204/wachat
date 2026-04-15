'use server';

export async function executeQontoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const BASE_URL = 'https://thirdparty.qonto.com/v2';
        const organizationSlug = inputs.organizationSlug;
        const secretKey = inputs.secretKey;

        const headers: Record<string, string> = {
            Authorization: `${organizationSlug}:${secretKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getOrganization': {
                const res = await fetch(`${BASE_URL}/organization`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listBankAccounts': {
                const params = new URLSearchParams();
                if (inputs.currentPage) params.set('current_page', inputs.currentPage);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                const res = await fetch(`${BASE_URL}/bank_accounts?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getBankAccount': {
                const res = await fetch(`${BASE_URL}/bank_accounts/${inputs.iban}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.bankAccountId) params.set('bank_account_id', inputs.bankAccountId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.updatedAtFrom) params.set('updated_at_from', inputs.updatedAtFrom);
                if (inputs.updatedAtTo) params.set('updated_at_to', inputs.updatedAtTo);
                if (inputs.settledAtFrom) params.set('settled_at_from', inputs.settledAtFrom);
                if (inputs.settledAtTo) params.set('settled_at_to', inputs.settledAtTo);
                if (inputs.currentPage) params.set('current_page', inputs.currentPage);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                const res = await fetch(`${BASE_URL}/transactions?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getTransaction': {
                const res = await fetch(`${BASE_URL}/transactions/${inputs.transactionId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listAttachments': {
                const params = new URLSearchParams();
                if (inputs.currentPage) params.set('current_page', inputs.currentPage);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                const res = await fetch(`${BASE_URL}/attachments?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getAttachment': {
                const res = await fetch(`${BASE_URL}/attachments/${inputs.attachmentId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listMembers': {
                const params = new URLSearchParams();
                if (inputs.currentPage) params.set('current_page', inputs.currentPage);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                const res = await fetch(`${BASE_URL}/memberships?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getMember': {
                const res = await fetch(`${BASE_URL}/memberships/${inputs.membershipId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.currentPage) params.set('current_page', inputs.currentPage);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${BASE_URL}/supplier_invoices?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createInvoice': {
                const body: any = {
                    supplier_invoice: {
                        supplier_name: inputs.supplierName,
                        invoice_number: inputs.invoiceNumber,
                        issue_date: inputs.issueDate,
                        due_date: inputs.dueDate,
                        total_amount: inputs.totalAmount,
                        currency: inputs.currency || 'EUR',
                        description: inputs.description || '',
                    },
                };
                const res = await fetch(`${BASE_URL}/supplier_invoices`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listLabels': {
                const params = new URLSearchParams();
                if (inputs.currentPage) params.set('current_page', inputs.currentPage);
                if (inputs.perPage) params.set('per_page', inputs.perPage);
                const res = await fetch(`${BASE_URL}/labels?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createLabel': {
                const body: any = {
                    label: {
                        name: inputs.name,
                        parent_id: inputs.parentId || null,
                    },
                };
                const res = await fetch(`${BASE_URL}/labels`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'requestTransfer': {
                const body: any = {
                    transfer: {
                        amount: inputs.amount,
                        currency: inputs.currency || 'EUR',
                        local_amount: inputs.localAmount,
                        local_currency: inputs.localCurrency,
                        note: inputs.note || '',
                        beneficiary: {
                            name: inputs.beneficiaryName,
                            iban: inputs.beneficiaryIban,
                            bic: inputs.beneficiaryBic,
                            email: inputs.beneficiaryEmail || '',
                        },
                        scheduled_date: inputs.scheduledDate || null,
                    },
                };
                const res = await fetch(`${BASE_URL}/transfers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.errors?.[0]?.detail || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Qonto action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger.log(`Qonto action error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeQontoAction' };
    }
}
