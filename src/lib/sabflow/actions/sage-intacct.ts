'use server';

export async function executeSageIntacctAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const senderId = inputs.senderId;
        const senderPassword = inputs.senderPassword;
        const companyId = inputs.companyId;
        const userId = inputs.userId;
        const password = inputs.password;
        const baseUrl = 'https://api.intacct.com/ia/xml/xmlgw.phtml';

        const controlId = `sabflow-${Date.now()}`;

        function buildRequest(functionXml: string): string {
            return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${senderId}</senderid>
    <password>${senderPassword}</password>
    <controlid>${controlId}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <login>
        <userid>${userId}</userid>
        <companyid>${companyId}</companyid>
        <password>${password}</password>
      </login>
    </authentication>
    <content>
      <function controlid="${controlId}">
        ${functionXml}
      </function>
    </content>
  </operation>
</request>`;
        }

        async function callIntacct(functionXml: string) {
            const xmlBody = buildRequest(functionXml);
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml',
                    Accept: 'application/xml',
                },
                body: xmlBody,
            });
            const text = await res.text();
            if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
            // Parse basic success/error from XML text
            if (text.includes('<status>failure</status>')) {
                const errMatch = text.match(/<errormessage>([\s\S]*?)<\/errormessage>/);
                const descMatch = text.match(/<description>([\s\S]*?)<\/description>/);
                return {
                    error:
                        descMatch?.[1]?.trim() ||
                        errMatch?.[1]?.trim() ||
                        'Sage Intacct returned failure status',
                };
            }
            return { rawXml: text };
        }

        switch (actionName) {
            case 'createCustomer': {
                const xml = `<create>
  <CUSTOMER>
    <CUSTOMERID>${inputs.customerId || ''}</CUSTOMERID>
    <NAME>${inputs.name}</NAME>
    <EMAIL1>${inputs.email || ''}</EMAIL1>
    <PHONE1>${inputs.phone || ''}</PHONE1>
    <STATUS>active</STATUS>
  </CUSTOMER>
</create>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { success: true, rawXml: result.rawXml } };
            }

            case 'readCustomer': {
                const xml = `<read>
  <object>CUSTOMER</object>
  <keys>${inputs.customerId}</keys>
  <fields>*</fields>
</read>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'updateCustomer': {
                const xml = `<update>
  <CUSTOMER>
    <CUSTOMERID>${inputs.customerId}</CUSTOMERID>
    ${inputs.name ? `<NAME>${inputs.name}</NAME>` : ''}
    ${inputs.email ? `<EMAIL1>${inputs.email}</EMAIL1>` : ''}
    ${inputs.phone ? `<PHONE1>${inputs.phone}</PHONE1>` : ''}
  </CUSTOMER>
</update>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { success: true, rawXml: result.rawXml } };
            }

            case 'deleteCustomer': {
                const xml = `<delete>
  <object>CUSTOMER</object>
  <keys>${inputs.customerId}</keys>
</delete>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { deleted: true, rawXml: result.rawXml } };
            }

            case 'listCustomers': {
                const xml = `<readByQuery>
  <object>CUSTOMER</object>
  <fields>*</fields>
  <query>${inputs.query || '1=1'}</query>
  <pagesize>${inputs.pageSize || 100}</pagesize>
</readByQuery>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'createInvoice': {
                const xml = `<create>
  <ARINVOICE>
    <CUSTOMERID>${inputs.customerId}</CUSTOMERID>
    <DATECREATED>
      <year>${inputs.year}</year>
      <month>${inputs.month}</month>
      <day>${inputs.day}</day>
    </DATECREATED>
    <TERMNAME>${inputs.termName || 'Net 30'}</TERMNAME>
    <INVOICEITEMS>
      <LINEITEM>
        <GLACCOUNTNO>${inputs.accountNo}</GLACCOUNTNO>
        <AMOUNT>${inputs.amount}</AMOUNT>
        <MEMO>${inputs.memo || ''}</MEMO>
      </LINEITEM>
    </INVOICEITEMS>
  </ARINVOICE>
</create>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { success: true, rawXml: result.rawXml } };
            }

            case 'readInvoice': {
                const xml = `<read>
  <object>ARINVOICE</object>
  <keys>${inputs.invoiceKey}</keys>
  <fields>*</fields>
</read>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'updateInvoice': {
                const xml = `<update>
  <ARINVOICE>
    <RECORDNO>${inputs.recordNo}</RECORDNO>
    ${inputs.memo ? `<DESCRIPTION>${inputs.memo}</DESCRIPTION>` : ''}
  </ARINVOICE>
</update>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { success: true, rawXml: result.rawXml } };
            }

            case 'deleteInvoice': {
                const xml = `<delete>
  <object>ARINVOICE</object>
  <keys>${inputs.invoiceKey}</keys>
</delete>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { deleted: true, rawXml: result.rawXml } };
            }

            case 'listInvoices': {
                const xml = `<readByQuery>
  <object>ARINVOICE</object>
  <fields>*</fields>
  <query>${inputs.query || '1=1'}</query>
  <pagesize>${inputs.pageSize || 100}</pagesize>
</readByQuery>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'createPayment': {
                const xml = `<create>
  <ARPYMT>
    <CUSTOMERID>${inputs.customerId}</CUSTOMERID>
    <PAYMENTAMOUNT>${inputs.amount}</PAYMENTAMOUNT>
    <DATERECEIVED>
      <year>${inputs.year}</year>
      <month>${inputs.month}</month>
      <day>${inputs.day}</day>
    </DATERECEIVED>
    <BATCHKEY>${inputs.batchKey || ''}</BATCHKEY>
    <INVOICEPAYMENTS>
      <INVOICEPAYMENT>
        <INVOICEKEY>${inputs.invoiceKey}</INVOICEKEY>
        <TRX_PAYMENTAMOUNT>${inputs.amount}</TRX_PAYMENTAMOUNT>
      </INVOICEPAYMENT>
    </INVOICEPAYMENTS>
  </ARPYMT>
</create>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { success: true, rawXml: result.rawXml } };
            }

            case 'readPayment': {
                const xml = `<read>
  <object>ARPYMT</object>
  <keys>${inputs.paymentKey}</keys>
  <fields>*</fields>
</read>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'listPayments': {
                const xml = `<readByQuery>
  <object>ARPYMT</object>
  <fields>*</fields>
  <query>${inputs.query || '1=1'}</query>
  <pagesize>${inputs.pageSize || 100}</pagesize>
</readByQuery>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'getAccount': {
                const xml = `<read>
  <object>GLACCOUNT</object>
  <keys>${inputs.accountKey}</keys>
  <fields>*</fields>
</read>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            case 'listAccounts': {
                const xml = `<readByQuery>
  <object>GLACCOUNT</object>
  <fields>*</fields>
  <query>${inputs.query || '1=1'}</query>
  <pagesize>${inputs.pageSize || 100}</pagesize>
</readByQuery>`;
                const result = await callIntacct(xml);
                if (result.error) return { error: result.error };
                return { output: { rawXml: result.rawXml } };
            }

            default:
                return { error: `Unknown Sage Intacct action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Sage Intacct action error: ${err.message}`);
        return { error: err.message || 'Sage Intacct action failed' };
    }
}
