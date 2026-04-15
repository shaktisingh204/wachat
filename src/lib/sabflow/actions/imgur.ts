
'use server';

const IMGUR_BASE = 'https://api.imgur.com/3';

async function imgurFetch(
    accessToken: string | undefined,
    clientId: string | undefined,
    method: string,
    path: string,
    body?: any,
    isFormData?: boolean,
    logger?: any
): Promise<any> {
    const url = `${IMGUR_BASE}${path}`;
    logger?.log(`[Imgur] ${method} ${path}`);

    const headers: Record<string, string> = {};

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (clientId) {
        headers['Authorization'] = `Client-ID ${clientId}`;
    } else {
        throw new Error('Either accessToken or clientId is required.');
    }

    const options: RequestInit = { method, headers };

    if (body !== undefined) {
        if (isFormData) {
            // body is already FormData or URLSearchParams
            options.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    const res = await fetch(url, options);

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok || data?.success === false) {
        throw new Error(
            data?.data?.error ||
            data?.error ||
            data?.message ||
            `Imgur API error: ${res.status}`
        );
    }

    return data?.data ?? data;
}

export async function executeImgurAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken ? String(inputs.accessToken).trim() : undefined;
        const clientId = inputs.clientId ? String(inputs.clientId).trim() : undefined;

        if (!accessToken && !clientId) {
            throw new Error('Either accessToken or clientId is required.');
        }

        const ig = (method: string, path: string, body?: any, isFormData?: boolean) =>
            imgurFetch(accessToken, clientId, method, path, body, isFormData, logger);

        switch (actionName) {
            case 'getImage': {
                const imageHash = String(inputs.imageHash ?? '').trim();
                if (!imageHash) throw new Error('imageHash is required.');
                const data = await ig('GET', `/image/${imageHash}`);
                return { output: { image: data } };
            }

            case 'uploadImage': {
                const imageUrl = inputs.imageUrl ? String(inputs.imageUrl).trim() : undefined;
                const imageBase64 = inputs.imageBase64 ? String(inputs.imageBase64).trim() : undefined;

                if (!imageUrl && !imageBase64) throw new Error('Either imageUrl or imageBase64 is required.');

                const formData = new URLSearchParams();
                if (imageUrl) {
                    formData.set('image', imageUrl);
                    formData.set('type', 'url');
                } else {
                    formData.set('image', imageBase64!);
                    formData.set('type', 'base64');
                }
                if (inputs.title) formData.set('title', String(inputs.title));
                if (inputs.description) formData.set('description', String(inputs.description));
                if (inputs.albumId) formData.set('album', String(inputs.albumId));

                const data = await ig('POST', '/image', formData, true);
                logger.log(`[Imgur] Image uploaded: ${data.id}`);
                return { output: { id: data.id, link: data.link, deleteHash: data.deletehash } };
            }

            case 'deleteImage': {
                const imageHash = String(inputs.imageHash ?? '').trim();
                if (!imageHash) throw new Error('imageHash is required.');
                await ig('DELETE', `/image/${imageHash}`);
                logger.log(`[Imgur] Image deleted: ${imageHash}`);
                return { output: { deleted: true } };
            }

            case 'listAlbums': {
                const username = String(inputs.username ?? 'me').trim();
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString();
                const data = await ig('GET', `/account/${username}/albums${qs ? `?${qs}` : ''}`);
                return { output: { albums: data } };
            }

            case 'getAlbum': {
                const albumHash = String(inputs.albumHash ?? '').trim();
                if (!albumHash) throw new Error('albumHash is required.');
                const data = await ig('GET', `/album/${albumHash}`);
                return { output: { album: data } };
            }

            case 'createAlbum': {
                const formData = new URLSearchParams();
                if (inputs.title) formData.set('title', String(inputs.title));
                if (inputs.description) formData.set('description', String(inputs.description));
                if (inputs.privacy) formData.set('privacy', String(inputs.privacy));
                const data = await ig('POST', '/album', formData, true);
                logger.log(`[Imgur] Album created: ${data.id}`);
                return { output: { id: data.id, deleteHash: data.deletehash } };
            }

            case 'updateAlbum': {
                const albumHash = String(inputs.albumHash ?? '').trim();
                if (!albumHash) throw new Error('albumHash is required.');
                const formData = new URLSearchParams();
                if (inputs.title) formData.set('title', String(inputs.title));
                if (inputs.description) formData.set('description', String(inputs.description));
                if (inputs.privacy) formData.set('privacy', String(inputs.privacy));
                await ig('PUT', `/album/${albumHash}`, formData, true);
                logger.log(`[Imgur] Album updated: ${albumHash}`);
                return { output: { updated: true } };
            }

            case 'deleteAlbum': {
                const albumHash = String(inputs.albumHash ?? '').trim();
                if (!albumHash) throw new Error('albumHash is required.');
                await ig('DELETE', `/album/${albumHash}`);
                logger.log(`[Imgur] Album deleted: ${albumHash}`);
                return { output: { deleted: true } };
            }

            case 'addToAlbum': {
                const albumHash = String(inputs.albumHash ?? '').trim();
                if (!albumHash) throw new Error('albumHash is required.');
                const ids = inputs.ids ?? [];
                if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids (array of image hashes) is required.');
                const formData = new URLSearchParams();
                ids.forEach((id: string) => formData.append('ids[]', String(id)));
                await ig('PUT', `/album/${albumHash}/add`, formData, true);
                logger.log(`[Imgur] Images added to album: ${albumHash}`);
                return { output: { added: true } };
            }

            case 'getAccountImages': {
                const username = String(inputs.username ?? 'me').trim();
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString();
                const data = await ig('GET', `/account/${username}/images${qs ? `?${qs}` : ''}`);
                return { output: { images: data } };
            }

            case 'getComments': {
                const imageHash = String(inputs.imageHash ?? '').trim();
                if (!imageHash) throw new Error('imageHash is required.');
                const data = await ig('GET', `/image/${imageHash}/comments`);
                return { output: { comments: data } };
            }

            case 'postComment': {
                const imageId = String(inputs.imageId ?? '').trim();
                const comment = String(inputs.comment ?? '').trim();
                if (!imageId) throw new Error('imageId is required.');
                if (!comment) throw new Error('comment is required.');
                const formData = new URLSearchParams();
                formData.set('image_id', imageId);
                formData.set('comment', comment);
                if (inputs.parentId) formData.set('parent_id', String(inputs.parentId));
                const data = await ig('POST', '/comment', formData, true);
                logger.log(`[Imgur] Comment posted: ${data}`);
                return { output: { commentId: data } };
            }

            case 'voteOnImage': {
                const imageHash = String(inputs.imageHash ?? '').trim();
                const vote = String(inputs.vote ?? '').trim();
                if (!imageHash) throw new Error('imageHash is required.');
                if (!['up', 'down', 'veto'].includes(vote)) throw new Error('vote must be "up", "down", or "veto".');
                const data = await ig('POST', `/image/${imageHash}/vote/${vote}`);
                return { output: { vote: data } };
            }

            default:
                return { error: `Imgur action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Imgur action failed.' };
    }
}
