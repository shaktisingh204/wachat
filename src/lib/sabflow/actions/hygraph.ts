
'use server';

export async function executeHygraphAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiUrl = String(inputs.apiUrl ?? '').trim();
        if (!apiUrl) throw new Error('apiUrl is required.');
        const accessToken = String(inputs.accessToken ?? '').trim();

        const gqlFetch = async (body: { query: string; variables?: any }, requireAuth = false) => {
            if (requireAuth && !accessToken) throw new Error('accessToken is required for this action.');
            logger?.log(`[Hygraph] POST ${apiUrl}`);
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { message: text }; }
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Hygraph API error: ${res.status}`);
            if (data?.errors?.length) throw new Error(data.errors[0].message);
            return data;
        };

        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

        switch (actionName) {
            case 'query': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const variables = inputs.variables ? (typeof inputs.variables === 'string' ? JSON.parse(inputs.variables) : inputs.variables) : undefined;
                const data = await gqlFetch({ query, variables });
                return { output: { data: data.data ?? {} } };
            }

            case 'listContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                const pluralName = inputs.pluralName ? String(inputs.pluralName).trim() : `${modelName}s`;
                const fields = String(inputs.fields ?? 'id').trim() || 'id';
                const first = Number(inputs.first ?? 100);
                const query = `{ ${pluralName}(first: ${first}) { ${fields} } }`;
                const data = await gqlFetch({ query });
                return { output: { items: data.data?.[pluralName] ?? [] } };
            }

            case 'getContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const fields = String(inputs.fields ?? 'id').trim() || 'id';
                const query = `{ ${modelName}(where: { id: "${id}" }) { ${fields} } }`;
                const data = await gqlFetch({ query });
                return { output: { item: data.data?.[modelName] ?? null } };
            }

            case 'createContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                if (!inputs.data) throw new Error('data is required.');
                const itemData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const ModelName = capitalize(modelName);
                const query = `mutation CreateContent($data: ${ModelName}CreateInput!) { create${ModelName}(data: $data) { id } }`;
                const data = await gqlFetch({ query, variables: { data: itemData } }, true);
                return { output: { item: data.data?.[`create${ModelName}`] ?? {} } };
            }

            case 'updateContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!inputs.data) throw new Error('data is required.');
                const itemData = typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data;
                const ModelName = capitalize(modelName);
                const query = `mutation UpdateContent($data: ${ModelName}UpdateInput!) { update${ModelName}(where: { id: "${id}" }, data: $data) { id } }`;
                const data = await gqlFetch({ query, variables: { data: itemData } }, true);
                return { output: { item: data.data?.[`update${ModelName}`] ?? {} } };
            }

            case 'deleteContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const ModelName = capitalize(modelName);
                const query = `mutation { delete${ModelName}(where: { id: "${id}" }) { id } }`;
                const data = await gqlFetch({ query }, true);
                return { output: { deleted: 'true', item: data.data?.[`delete${ModelName}`] ?? {} } };
            }

            case 'publishContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const ModelName = capitalize(modelName);
                const to = inputs.to ?? ['PUBLISHED'];
                const stages = Array.isArray(to) ? to : [to];
                const query = `mutation { publish${ModelName}(where: { id: "${id}" }, to: [${stages.join(', ')}]) { id } }`;
                const data = await gqlFetch({ query }, true);
                return { output: { item: data.data?.[`publish${ModelName}`] ?? {} } };
            }

            case 'unpublishContent': {
                const modelName = String(inputs.modelName ?? '').trim();
                if (!modelName) throw new Error('modelName is required.');
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const ModelName = capitalize(modelName);
                const from = inputs.from ?? ['PUBLISHED'];
                const stages = Array.isArray(from) ? from : [from];
                const query = `mutation { unpublish${ModelName}(where: { id: "${id}" }, from: [${stages.join(', ')}]) { id } }`;
                const data = await gqlFetch({ query }, true);
                return { output: { item: data.data?.[`unpublish${ModelName}`] ?? {} } };
            }

            case 'listLocales': {
                const query = `{ __type(name: "Locale") { enumValues { name } } }`;
                const data = await gqlFetch({ query });
                const locales = data.data?.__type?.enumValues?.map((v: any) => v.name) ?? [];
                return { output: { locales } };
            }

            case 'uploadAsset': {
                const projectId = String(inputs.projectId ?? '').trim();
                const stage = String(inputs.stage ?? 'master').trim() || 'master';
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                if (!projectId) throw new Error('projectId is required for uploadAsset.');
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);
                const blob = await fileRes.blob();
                const filename = inputs.filename ? String(inputs.filename) : 'upload';
                const formData = new FormData();
                formData.append('fileUpload', blob, filename);
                const uploadUrl = `https://upload.graphcms.com/v2/${projectId}/${stage}`;
                logger?.log(`[Hygraph] POST ${uploadUrl}`);
                const res = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
                    body: formData,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { message: text }; }
                if (!res.ok) throw new Error(data?.message || `Hygraph upload error: ${res.status}`);
                return { output: { asset: data } };
            }

            case 'listAssets': {
                const fields = String(inputs.fields ?? 'id fileName url mimeType size').trim() || 'id fileName url mimeType size';
                const first = Number(inputs.first ?? 100);
                const query = `{ assets(first: ${first}) { ${fields} } }`;
                const data = await gqlFetch({ query });
                return { output: { assets: data.data?.assets ?? [] } };
            }

            default:
                return { error: `Hygraph action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Hygraph action failed.' };
    }
}
