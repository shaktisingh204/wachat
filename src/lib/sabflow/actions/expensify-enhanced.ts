'use server';

export async function executeExpensifyEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';
  const partnerId = inputs.partnerId;
  const partnerSecret = inputs.partnerSecret;

  try {
    switch (actionName) {
      case 'createExpense': {
        const payload = {
          type: 'create',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'expenses',
            employees: inputs.employees || [],
            expense: inputs.expense || {},
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'updateExpense': {
        const payload = {
          type: 'update',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'expenses',
            transactionID: inputs.transactionID,
            expense: inputs.expense || {},
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'getExpense': {
        const payload = {
          type: 'get',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'expenses',
            transactionID: inputs.transactionID,
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'listExpenses': {
        const payload = {
          type: 'get',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'expenses',
            filters: inputs.filters || {},
            limit: inputs.limit || 100,
            offset: inputs.offset || 0,
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'createReport': {
        const payload = {
          type: 'create',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            employees: inputs.employees || [],
            report: inputs.report || {},
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'updateReport': {
        const payload = {
          type: 'update',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            reportID: inputs.reportID,
            report: inputs.report || {},
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'getReport': {
        const payload = {
          type: 'get',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            reportID: inputs.reportID,
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'listReports': {
        const payload = {
          type: 'get',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            filters: inputs.filters || {},
            limit: inputs.limit || 100,
            offset: inputs.offset || 0,
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'submitReport': {
        const payload = {
          type: 'update',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            reportID: inputs.reportID,
            action: 'submit',
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'approveReport': {
        const payload = {
          type: 'update',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            reportID: inputs.reportID,
            action: 'approve',
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'rejectReport': {
        const payload = {
          type: 'update',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'report',
            reportID: inputs.reportID,
            action: 'reject',
            message: inputs.message || '',
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'getPolicy': {
        const payload = {
          type: 'get',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'policy',
            policyID: inputs.policyID,
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'listPolicies': {
        const payload = {
          type: 'get',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'policy',
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      case 'exportReport': {
        const payload = {
          type: 'file',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'combinedReportData',
            reportID: inputs.reportID,
            format: inputs.format || 'CSV',
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const text = await res.text();
        return { output: { content: text } };
      }

      case 'createTag': {
        const payload = {
          type: 'update',
          credentials: { partnerUserID: partnerId, partnerUserSecret: partnerSecret },
          inputSettings: {
            type: 'tag',
            policyID: inputs.policyID,
            tags: inputs.tags || [],
          },
        };
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `requestJobDescription=${encodeURIComponent(JSON.stringify(payload))}`,
        });
        const data = await res.json();
        return { output: data };
      }

      default:
        return { error: `Unknown Expensify Enhanced action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`ExpensifyEnhanced error: ${err.message}`);
    return { error: err.message || 'ExpensifyEnhanced action failed' };
  }
}
