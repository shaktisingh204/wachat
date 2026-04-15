
'use server';

export async function executeAwsS3Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const { S3Client, ListBucketsCommand, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, CreateBucketCommand, DeleteBucketCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

        switch (actionName) {
            case 'listBuckets': {
                logger.log('[S3] Listing buckets');
                const result = await s3.send(new ListBucketsCommand({}));
                const buckets = (result.Buckets ?? []).map(b => ({ name: b.Name, createdAt: b.CreationDate?.toISOString() }));
                return { output: { buckets, count: String(buckets.length) } };
            }

            case 'listObjects': {
                const bucket = String(inputs.bucket ?? '').trim();
                const prefix = String(inputs.prefix ?? '').trim();
                const maxKeys = Number(inputs.maxKeys ?? 100);
                if (!bucket) throw new Error('bucket is required.');
                logger.log(`[S3] Listing objects in ${bucket}`);
                const result = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, MaxKeys: maxKeys }));
                const objects = (result.Contents ?? []).map(o => ({ key: o.Key, size: String(o.Size), lastModified: o.LastModified?.toISOString() }));
                return { output: { objects, count: String(objects.length), isTruncated: String(result.IsTruncated ?? false) } };
            }

            case 'getObject': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!bucket || !key) throw new Error('bucket and key are required.');
                logger.log(`[S3] Getting object ${key} from ${bucket}`);
                const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
                const body = await result.Body?.transformToString();
                return { output: { body: body ?? '', contentType: result.ContentType ?? '', size: String(result.ContentLength ?? 0) } };
            }

            case 'uploadObject': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const contentType = String(inputs.contentType ?? 'text/plain').trim();
                if (!bucket || !key || !body) throw new Error('bucket, key, and body are required.');
                logger.log(`[S3] Uploading object ${key} to ${bucket}`);
                await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
                return { output: { key, bucket, url: `https://${bucket}.s3.${region}.amazonaws.com/${key}` } };
            }

            case 'deleteObject': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!bucket || !key) throw new Error('bucket and key are required.');
                logger.log(`[S3] Deleting object ${key} from ${bucket}`);
                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
                return { output: { deleted: 'true', key, bucket } };
            }

            case 'copyObject': {
                const sourceBucket = String(inputs.sourceBucket ?? '').trim();
                const sourceKey = String(inputs.sourceKey ?? '').trim();
                const destBucket = String(inputs.destBucket ?? '').trim();
                const destKey = String(inputs.destKey ?? '').trim();
                if (!sourceBucket || !sourceKey || !destBucket || !destKey) throw new Error('sourceBucket, sourceKey, destBucket, and destKey are required.');
                logger.log(`[S3] Copying object`);
                await s3.send(new CopyObjectCommand({ Bucket: destBucket, CopySource: `${sourceBucket}/${sourceKey}`, Key: destKey }));
                return { output: { copied: 'true', destBucket, destKey } };
            }

            case 'getPresignedUrl': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const expiresIn = Number(inputs.expiresIn ?? 3600);
                const operation = String(inputs.operation ?? 'get').trim();
                if (!bucket || !key) throw new Error('bucket and key are required.');
                logger.log(`[S3] Generating presigned URL for ${key}`);
                const command = operation === 'put' ? new PutObjectCommand({ Bucket: bucket, Key: key }) : new GetObjectCommand({ Bucket: bucket, Key: key });
                const url = await getSignedUrl(s3 as any, command as any, { expiresIn });
                return { output: { url, expiresIn: String(expiresIn), key, bucket } };
            }

            case 'createBucket': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                logger.log(`[S3] Creating bucket ${bucket}`);
                const config: any = { Bucket: bucket };
                if (region !== 'us-east-1') config.CreateBucketConfiguration = { LocationConstraint: region };
                await s3.send(new CreateBucketCommand(config));
                return { output: { bucket, created: 'true' } };
            }

            case 'deleteBucket': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                logger.log(`[S3] Deleting bucket ${bucket}`);
                await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
                return { output: { bucket, deleted: 'true' } };
            }

            default:
                return { error: `AWS S3 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AWS S3 action failed.' };
    }
}
