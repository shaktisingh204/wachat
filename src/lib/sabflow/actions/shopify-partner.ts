'use server';

async function shopifyPartnerGraphQL(organizationId: string, accessToken: string, query: string, variables?: Record<string, any>) {
    const endpoint = `https://partners.shopify.com/${organizationId}/graphql.json`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query, variables: variables || {} }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.errors?.[0]?.message || 'GraphQL request failed', data: null };
    if (data.errors) return { error: data.errors[0]?.message || 'GraphQL errors', data: null };
    return { error: null, data: data.data };
}

export async function executeShopifyPartnerAction(actionName: string, inputs: any, user: any, logger: any) {
    const { organizationId, accessToken } = inputs;

    try {
        switch (actionName) {
            case 'listApps': {
                const query = `
                    query listApps($organizationId: ID!) {
                        organization(id: $organizationId) {
                            apps(first: ${inputs.first || 50}) {
                                edges {
                                    node {
                                        id
                                        name
                                        createUrl
                                        appType
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'getApp': {
                const query = `
                    query getApp($id: ID!) {
                        app(id: $id) {
                            id
                            name
                            createUrl
                            appType
                            requestedAccessScopes {
                                handle
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { id: inputs.appId });
                if (error) return { error };
                return { output: data };
            }
            case 'listStores': {
                const query = `
                    query listStores($organizationId: ID!) {
                        organization(id: $organizationId) {
                            stores(first: ${inputs.first || 50}) {
                                edges {
                                    node {
                                        id
                                        name
                                        shopifyDomain
                                        myshopifyDomain
                                        platform
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'getStore': {
                const query = `
                    query getStore($id: ID!) {
                        shop(id: $id) {
                            id
                            name
                            shopifyDomain
                            myshopifyDomain
                            plan {
                                displayName
                                partnerDevelopment
                                shopifyPlus
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { id: inputs.storeId });
                if (error) return { error };
                return { output: data };
            }
            case 'getEvents': {
                const query = `
                    query getEvents($organizationId: ID!) {
                        organization(id: $organizationId) {
                            events(first: ${inputs.first || 50}, types: [${inputs.types || 'RELATIONSHIP_INSTALLED'}]) {
                                edges {
                                    node {
                                        type
                                        occurredAt
                                        shop {
                                            myshopifyDomain
                                        }
                                        app {
                                            name
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'listPayouts': {
                const query = `
                    query listPayouts($organizationId: ID!) {
                        organization(id: $organizationId) {
                            payouts(first: ${inputs.first || 50}) {
                                edges {
                                    node {
                                        id
                                        issuedAt
                                        status
                                        total {
                                            amount
                                            currencyCode
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'getPayout': {
                const query = `
                    query getPayout($id: ID!) {
                        payout(id: $id) {
                            id
                            issuedAt
                            status
                            total {
                                amount
                                currencyCode
                            }
                            transactions(first: 50) {
                                edges {
                                    node {
                                        id
                                        createdAt
                                        netAmount {
                                            amount
                                            currencyCode
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { id: inputs.payoutId });
                if (error) return { error };
                return { output: data };
            }
            case 'listTransactions': {
                const query = `
                    query listTransactions($organizationId: ID!) {
                        organization(id: $organizationId) {
                            transactions(first: ${inputs.first || 50}) {
                                edges {
                                    node {
                                        id
                                        createdAt
                                        netAmount {
                                            amount
                                            currencyCode
                                        }
                                        shop {
                                            myshopifyDomain
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'getTransaction': {
                const query = `
                    query getTransaction($id: ID!) {
                        transaction(id: $id) {
                            id
                            createdAt
                            netAmount {
                                amount
                                currencyCode
                            }
                            grossAmount {
                                amount
                                currencyCode
                            }
                            shop {
                                myshopifyDomain
                                name
                            }
                            app {
                                name
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { id: inputs.transactionId });
                if (error) return { error };
                return { output: data };
            }
            case 'getOrganization': {
                const query = `
                    query getOrganization($id: ID!) {
                        organization(id: $id) {
                            id
                            name
                            businessAddress {
                                address1
                                city
                                countryCode
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { id: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'listStaff': {
                const query = `
                    query listStaff($organizationId: ID!) {
                        organization(id: $organizationId) {
                            staffMembers(first: ${inputs.first || 50}) {
                                edges {
                                    node {
                                        id
                                        email
                                        isOwner
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'inviteStaff': {
                const mutation = `
                    mutation inviteStaff($input: StaffMemberInviteInput!) {
                        staffMemberCreate(input: $input) {
                            staffMember {
                                id
                                email
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }
                `;
                const variables = {
                    input: {
                        email: inputs.email,
                        organizationId: `gid://partners/Organization/${organizationId}`,
                    },
                };
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, mutation, variables);
                if (error) return { error };
                if (data?.staffMemberCreate?.userErrors?.length) {
                    return { error: data.staffMemberCreate.userErrors[0].message };
                }
                return { output: data };
            }
            case 'listCollaboratorRequests': {
                const query = `
                    query listCollaboratorRequests($organizationId: ID!) {
                        organization(id: $organizationId) {
                            collaboratorRequests(first: ${inputs.first || 50}) {
                                edges {
                                    node {
                                        id
                                        createdAt
                                        requestMessage
                                        shop {
                                            myshopifyDomain
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { organizationId: `gid://partners/Organization/${organizationId}` });
                if (error) return { error };
                return { output: data };
            }
            case 'appInstallCount': {
                const query = `
                    query appInstallCount($appId: ID!) {
                        app(id: $appId) {
                            id
                            name
                            events(first: 1, types: [RELATIONSHIP_INSTALLED]) {
                                edges {
                                    node {
                                        type
                                    }
                                }
                                pageInfo {
                                    hasNextPage
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { appId: inputs.appId });
                if (error) return { error };
                return { output: data };
            }
            case 'appInstallByDate': {
                const query = `
                    query appInstallByDate($appId: ID!) {
                        app(id: $appId) {
                            id
                            name
                            events(first: ${inputs.first || 50}, types: [RELATIONSHIP_INSTALLED]) {
                                edges {
                                    node {
                                        type
                                        occurredAt
                                        shop {
                                            myshopifyDomain
                                            name
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;
                const { error, data } = await shopifyPartnerGraphQL(organizationId, accessToken, query, { appId: inputs.appId });
                if (error) return { error };
                return { output: data };
            }
            default:
                return { error: `Unknown Shopify Partner action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Shopify Partner action error: ${err.message}`);
        return { error: err.message || 'Shopify Partner action failed' };
    }
}
