'use server';

const BASE_URL = 'https://www.filestackapi.com/api';

export async function executeFilestackAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing required credential: apiKey' };

        switch (actionName) {
            case 'uploadFile': {
                const fileUrl = inputs.fileUrl || inputs.url;
                const res = await fetch(`${BASE_URL}/store/S3?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: fileUrl }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Upload failed' };
                return { output: data };
            }

            case 'getFile': {
                const handle = inputs.handle;
                const res = await fetch(`https://cdn.filestackcontent.com/${handle}?key=${apiKey}`);
                if (!res.ok) return { error: `Get file failed: ${res.statusText}` };
                const buffer = await res.arrayBuffer();
                return { output: { handle, size: buffer.byteLength, contentType: res.headers.get('content-type') } };
            }

            case 'getMetadata': {
                const handle = inputs.handle;
                const res = await fetch(`https://www.filestackapi.com/filelink/${handle}/metadata?key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Get metadata failed' };
                return { output: data };
            }

            case 'deleteFile': {
                const handle = inputs.handle;
                const res = await fetch(`${BASE_URL}/file/${handle}?key=${apiKey}`, {
                    method: 'DELETE',
                });
                if (!res.ok) return { error: `Delete failed: ${res.statusText}` };
                return { output: { deleted: true, handle } };
            }

            case 'transformImage': {
                const handle = inputs.handle;
                const transformations = inputs.transformations || 'resize=width:200';
                const url = `https://cdn.filestackcontent.com/${transformations}/${handle}`;
                return { output: { transformedUrl: url, handle } };
            }

            case 'resizeImage': {
                const handle = inputs.handle;
                const width = inputs.width || 800;
                const height = inputs.height;
                const params = height ? `resize=width:${width},height:${height}` : `resize=width:${width}`;
                const url = `https://cdn.filestackcontent.com/${params}/${handle}`;
                return { output: { resizedUrl: url, handle, width, height } };
            }

            case 'convertFile': {
                const handle = inputs.handle;
                const format = inputs.format || 'pdf';
                const url = `https://cdn.filestackcontent.com/output=format:${format}/${handle}`;
                return { output: { convertedUrl: url, format, handle } };
            }

            case 'convertToJpeg': {
                const handle = inputs.handle;
                const quality = inputs.quality || 80;
                const url = `https://cdn.filestackcontent.com/output=format:jpg,quality:${quality}/${handle}`;
                return { output: { convertedUrl: url, format: 'jpeg', handle } };
            }

            case 'convertToPdf': {
                const handle = inputs.handle;
                const url = `https://cdn.filestackcontent.com/output=format:pdf/${handle}`;
                return { output: { convertedUrl: url, format: 'pdf', handle } };
            }

            case 'detectFaces': {
                const handle = inputs.handle;
                const res = await fetch(`https://cdn.filestackcontent.com/detect_faces/${handle}?key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Face detection failed' };
                return { output: data };
            }

            case 'detectTags': {
                const handle = inputs.handle;
                const res = await fetch(`https://cdn.filestackcontent.com/tags/${handle}?key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Tag detection failed' };
                return { output: data };
            }

            case 'getSecurity': {
                const policy = inputs.policy || {};
                const expiry = inputs.expiry || Math.floor(Date.now() / 1000) + 3600;
                const policyObj = { expiry, ...policy };
                const policyB64 = Buffer.from(JSON.stringify(policyObj)).toString('base64');
                return { output: { policy: policyB64, note: 'Sign with your app secret using HMAC-SHA256' } };
            }

            case 'storeUrl': {
                const url = inputs.url;
                const storeOptions = inputs.storeOptions || {};
                const res = await fetch(`${BASE_URL}/store/S3?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, ...storeOptions }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Store URL failed' };
                return { output: data };
            }

            case 'getExif': {
                const handle = inputs.handle;
                const res = await fetch(`https://cdn.filestackcontent.com/exif/${handle}?key=${apiKey}`);
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Get EXIF failed' };
                return { output: data };
            }

            case 'zipFiles': {
                const handles = inputs.handles || [];
                const zipUrl = `https://cdn.filestackcontent.com/zip/[${handles.join(',')}]?key=${apiKey}`;
                return { output: { zipUrl, handles } };
            }

            default:
                return { error: `Unknown Filestack action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Filestack action error: ${err.message}`);
        return { error: err.message || 'Filestack action failed' };
    }
}
