import assert from 'node:assert/strict';
import test from 'node:test';

import type { SabfilesNode } from '@/lib/rust-client/sabfiles';
import {
    formatShareFileSize,
    getSabfilesOpenIntent,
    getSharePreviewKind,
} from '../share-ui';

function node(overrides: Partial<SabfilesNode>): SabfilesNode {
    return {
        _id: overrides.id || '1',
        id: overrides.id || '1',
        userId: 'user-1',
        parentId: null,
        type: 'file',
        name: 'File',
        createdAt: '2026-05-09T00:00:00.000Z',
        updatedAt: '2026-05-09T00:00:00.000Z',
        ...overrides,
    };
}

test('getSabfilesOpenIntent navigates folders but opens file actions', () => {
    assert.equal(getSabfilesOpenIntent(node({ type: 'folder' })), 'navigate');
    assert.equal(getSabfilesOpenIntent(node({ type: 'file' })), 'actions');
});

test('getSharePreviewKind classifies common public share previews', () => {
    assert.equal(getSharePreviewKind('image/jpeg'), 'image');
    assert.equal(getSharePreviewKind('video/mp4'), 'video');
    assert.equal(getSharePreviewKind('application/pdf'), 'document');
    assert.equal(getSharePreviewKind('text/plain'), 'document');
    assert.equal(getSharePreviewKind(undefined), 'file');
});

test('formatShareFileSize formats readable file sizes', () => {
    assert.equal(formatShareFileSize(undefined), 'Size unavailable');
    assert.equal(formatShareFileSize(512), '512 B');
    assert.equal(formatShareFileSize(1536), '1.5 KB');
    assert.equal(formatShareFileSize(5 * 1024 * 1024), '5.0 MB');
});
