'use server';

const STORYBLOK_MGMT_BASE = 'https://mapi.storyblok.com/v1';

export async function executeStoryblokEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const personalAccessToken: string = inputs.personalAccessToken;
        const previewToken: string = inputs.previewToken;

        async function mgmt(method: string, path: string, body?: any) {
            if (!personalAccessToken) return { error: 'inputs.personalAccessToken is required for management API' };
            const res = await fetch(`${STORYBLOK_MGMT_BASE}${path}`, {
                method,
                headers: {
                    'Authorization': personalAccessToken,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) return { error: data?.error || data?.message || `HTTP ${res.status}` };
            return { output: data };
        }

        async function cdn(path: string, extraParams: string = '') {
            if (!previewToken) return { error: 'inputs.previewToken is required for content delivery API' };
            const sep = path.includes('?') ? '&' : '?';
            const res = await fetch(`https://api.storyblok.com/v2/cdn${path}${sep}token=${previewToken}${extraParams ? '&' + extraParams : ''}`, {
                headers: { 'Content-Type': 'application/json' },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) return { error: data?.error || `HTTP ${res.status}` };
            return { output: data };
        }

        switch (actionName) {
            case 'listSpaces': {
                return mgmt('GET', '/spaces/');
            }
            case 'getSpace': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                return mgmt('GET', `/spaces/${spaceId}/`);
            }
            case 'listStories': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                const page = inputs.page || 1;
                const perPage = inputs.perPage || 25;
                let qs = `?page=${page}&per_page=${perPage}`;
                if (inputs.folder) qs += `&with_tag=${encodeURIComponent(inputs.folder)}`;
                if (inputs.searchTerm) qs += `&search_term=${encodeURIComponent(inputs.searchTerm)}`;
                return mgmt('GET', `/spaces/${spaceId}/stories/${qs}`);
            }
            case 'getStory': {
                const spaceId = inputs.spaceId;
                const storyId = inputs.storyId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!storyId) return { error: 'inputs.storyId is required' };
                return mgmt('GET', `/spaces/${spaceId}/stories/${storyId}/`);
            }
            case 'createStory': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!inputs.name) return { error: 'inputs.name is required' };
                if (!inputs.slug) return { error: 'inputs.slug is required' };
                const story: any = { name: inputs.name, slug: inputs.slug };
                if (inputs.content) story.content = inputs.content;
                if (inputs.parentId) story.parent_id = inputs.parentId;
                if (inputs.isFolder) story.is_folder = inputs.isFolder;
                return mgmt('POST', `/spaces/${spaceId}/stories/`, { story });
            }
            case 'updateStory': {
                const spaceId = inputs.spaceId;
                const storyId = inputs.storyId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!storyId) return { error: 'inputs.storyId is required' };
                const story: any = {};
                if (inputs.name) story.name = inputs.name;
                if (inputs.slug) story.slug = inputs.slug;
                if (inputs.content) story.content = inputs.content;
                return mgmt('PUT', `/spaces/${spaceId}/stories/${storyId}/`, { story });
            }
            case 'deleteStory': {
                const spaceId = inputs.spaceId;
                const storyId = inputs.storyId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!storyId) return { error: 'inputs.storyId is required' };
                return mgmt('DELETE', `/spaces/${spaceId}/stories/${storyId}/`);
            }
            case 'publishStory': {
                const spaceId = inputs.spaceId;
                const storyId = inputs.storyId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!storyId) return { error: 'inputs.storyId is required' };
                return mgmt('GET', `/spaces/${spaceId}/stories/${storyId}/publish/`);
            }
            case 'unpublishStory': {
                const spaceId = inputs.spaceId;
                const storyId = inputs.storyId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!storyId) return { error: 'inputs.storyId is required' };
                return mgmt('GET', `/spaces/${spaceId}/stories/${storyId}/unpublish/`);
            }
            case 'listComponents': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                return mgmt('GET', `/spaces/${spaceId}/components/`);
            }
            case 'createComponent': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!inputs.name) return { error: 'inputs.name is required' };
                const component: any = { name: inputs.name };
                if (inputs.displayName) component.display_name = inputs.displayName;
                if (inputs.schema) component.schema = inputs.schema;
                if (inputs.isRoot) component.is_root = inputs.isRoot;
                if (inputs.isNestable) component.is_nestable = inputs.isNestable;
                return mgmt('POST', `/spaces/${spaceId}/components/`, { component });
            }
            case 'listDatasources': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                return mgmt('GET', `/spaces/${spaceId}/datasources/`);
            }
            case 'createDatasource': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!inputs.name) return { error: 'inputs.name is required' };
                if (!inputs.slug) return { error: 'inputs.slug is required' };
                const datasource: any = { name: inputs.name, slug: inputs.slug };
                return mgmt('POST', `/spaces/${spaceId}/datasources/`, { datasource });
            }
            case 'listAssets': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                const page = inputs.page || 1;
                const perPage = inputs.perPage || 25;
                return mgmt('GET', `/spaces/${spaceId}/assets/?page=${page}&per_page=${perPage}`);
            }
            case 'uploadAsset': {
                const spaceId = inputs.spaceId;
                if (!spaceId) return { error: 'inputs.spaceId is required' };
                if (!inputs.filename) return { error: 'inputs.filename is required' };
                if (!personalAccessToken) return { error: 'inputs.personalAccessToken is required' };
                const signRes = await fetch(`${STORYBLOK_MGMT_BASE}/spaces/${spaceId}/assets/`, {
                    method: 'POST',
                    headers: { 'Authorization': personalAccessToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: inputs.filename, size: inputs.size || '' }),
                });
                const signData = await signRes.json();
                if (!signRes.ok) return { error: signData?.error || `Signed upload failed: HTTP ${signRes.status}` };
                return { output: { signedUploadDetails: signData, message: 'Use the returned signed_request to upload the file via multipart POST' } };
            }
            case 'getStoryCdn': {
                const slug = inputs.slug;
                if (!slug) return { error: 'inputs.slug is required' };
                const version = inputs.version || 'published';
                return cdn(`/stories/${slug}`, `version=${version}`);
            }
            default:
                return { error: `Unknown Storyblok Enhanced action: ${actionName}` };
        }
    } catch (e: any) {
        return { error: e?.message || 'Unknown error in executeStoryblokEnhancedAction' };
    }
}
