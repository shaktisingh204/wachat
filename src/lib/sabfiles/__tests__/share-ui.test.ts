import assert from 'node:assert/strict';
import test from 'node:test';

import type { SabfilesNode } from '@/lib/rust-client/sabfiles';
import {
    formatShareFileSize,
    getSabfilesOpenIntent,
    getShareAccessLabel,
    getShareFileExtension,
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
    assert.equal(getSharePreviewKind('audio/mpeg'), 'audio');
    assert.equal(getSharePreviewKind('application/pdf'), 'document');
    assert.equal(getSharePreviewKind('text/plain'), 'document');
    assert.equal(
        getSharePreviewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        'office',
    );
    assert.equal(
        getSharePreviewKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        'office',
    );
    assert.equal(
        getSharePreviewKind('application/vnd.ms-powerpoint'),
        'office',
    );
    assert.equal(getSharePreviewKind(undefined), 'file');
});

test('formatShareFileSize formats readable file sizes', () => {
    assert.equal(formatShareFileSize(undefined), 'Size unavailable');
    assert.equal(formatShareFileSize(512), '512 B');
    assert.equal(formatShareFileSize(1536), '1.5 KB');
    assert.equal(formatShareFileSize(5 * 1024 * 1024), '5.0 MB');
});

test('getShareFileExtension extracts a compact uppercase extension', () => {
    assert.equal(getShareFileExtension('report.final.pdf'), 'PDF');
    assert.equal(getShareFileExtension('archive.verylongextension'), 'VERYLONGEXTE');
    assert.equal(getShareFileExtension('README'), 'Unknown');
    assert.equal(getShareFileExtension('.env'), 'Unknown');
});

test('getShareAccessLabel describes public share access clearly', () => {
    assert.equal(getShareAccessLabel(true, true), 'Password protected download');
    assert.equal(getShareAccessLabel(true, false), 'Password protected view');
    assert.equal(getShareAccessLabel(false, true), 'Link can download');
    assert.equal(getShareAccessLabel(false, false), 'View only link');
});
