'use client';

/**
 * Sab Vault — client orchestrator (the whole experience).
 *
 * SECURITY INVARIANT: the master `CryptoKey` lives ONLY in React state + a ref.
 * It is never written to localStorage, sessionStorage, cookies, or IndexedDB,
 * and it is non-extractable (see `deriveMasterKey`). It is cleared on explicit
 * lock, on 15 minutes of inactivity, and whenever the tab is backgrounded.
 *
 * Three modes:
 *   · SETUP   — no key yet: mint salt + canary, derive key, unlock.
 *   · UNLOCK  — key exists, not yet unlocked: derive + verify canary.
 *   · UNLOCKED — encrypt-on-upload, decrypt-on-download, delete.
 *
 * The upload pipeline mirrors file-manager's presign -> XHR PUT (with progress)
 * -> confirm flow; the only difference is the bytes are ciphertext and the node
 * is confirmed via `confirmVaultUpload` with an encrypted name/mime envelope.
 */

import * as React from 'react';
import {
    FileUp,
    Loader2,
    Lock,
    ShieldCheck,
    UploadCloud,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Progress,
    useToast,
} from '@/components/sabcrm/20ui';
import type { SabfilesNode } from '@/lib/rust-client/sabfiles';
import {
    confirmVaultUpload,
    createVaultKey,
} from '@/app/actions/sabfiles-vault.actions';
import { getDownloadUrl, presignUpload, trashNodes } from '@/app/actions/sabfiles.actions';
import {
    base64ToBytes,
    bytesToBase64,
    decryptBytes,
    decryptPayload,
    deriveMasterKey,
    encryptBytes,
    encryptPayload,
    makeCanary,
    newSalt,
    verifyCanary,
} from '@/lib/sabfiles/vault/crypto';

import { VaultGate } from './vault-gate';
import { VaultFileList, type VaultDisplay } from './vault-file-list';

import './vault.css';

/** Vault files are capped until chunked encryption lands (WebCrypto buffers all). */
const MAX_VAULT_BYTES = 150 * 1024 * 1024;
/** Inactivity window before the vault auto-locks itself. */
const AUTO_LOCK_MS = 15 * 60 * 1000;

type UploadTask = {
    id: string;
    label: string;
    progress: number;
    status: 'encrypting' | 'uploading' | 'done' | 'error';
    error?: string;
};

type VaultClientProps = {
    initialKeyExists: boolean;
    initialSalt: string | null;
    initialCanary: string | null;
    initialNodes: SabfilesNode[];
};

export function VaultClient({
    initialKeyExists,
    initialSalt,
    initialCanary,
    initialNodes,
}: VaultClientProps): React.JSX.Element {
    const { toast } = useToast();

    // The master key lives here and ONLY here (state for render, ref for handlers).
    const [masterKey, setMasterKey] = React.useState<CryptoKey | null>(null);
    const masterKeyRef = React.useRef<CryptoKey | null>(null);
    const [unlocked, setUnlocked] = React.useState(false);
    const [keyExists, setKeyExists] = React.useState(initialKeyExists);

    const [nodes, setNodes] = React.useState<SabfilesNode[]>(initialNodes);
    const [displays, setDisplays] = React.useState<Record<string, VaultDisplay>>({});
    const [uploads, setUploads] = React.useState<UploadTask[]>([]);

    const [gateBusy, setGateBusy] = React.useState(false);
    const [gateError, setGateError] = React.useState<string | null>(null);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [dragging, setDragging] = React.useState(false);
    /** Polite announcement for screen readers on lock/unlock. */
    const [statusMsg, setStatusMsg] = React.useState('');

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const setKey = React.useCallback((key: CryptoKey | null) => {
        masterKeyRef.current = key;
        setMasterKey(key);
    }, []);

    /* ── Lock (clears the key from memory) ──────────────────────────────── */

    const lock = React.useCallback(() => {
        if (!masterKeyRef.current && !unlocked) return;
        setKey(null);
        setUnlocked(false);
        setDisplays({});
        setUploads([]);
        setGateError(null);
        setStatusMsg('Vault locked.');
    }, [setKey, unlocked]);

    /* ── Decrypt all node metas after unlock ────────────────────────────── */

    const decryptAllMetas = React.useCallback(
        async (key: CryptoKey, list: SabfilesNode[]) => {
            const next: Record<string, VaultDisplay> = {};
            await Promise.all(
                list.map(async (node) => {
                    if (!node.vaultMeta) return;
                    try {
                        next[node.id] = await decryptPayload<VaultDisplay>(node.vaultMeta, key);
                    } catch {
                        next[node.id] = { name: 'Encrypted file' };
                    }
                }),
            );
            setDisplays(next);
        },
        [],
    );

    /* ── SETUP: mint salt + canary, derive key, persist bootstrap ───────── */

    const handleCreate = React.useCallback(
        async (password: string) => {
            setGateBusy(true);
            setGateError(null);
            try {
                const salt = newSalt();
                const key = await deriveMasterKey(password, salt);
                const canary = await makeCanary(key);
                const res = await createVaultKey({
                    salt_b64: bytesToBase64(salt),
                    canary_b64: canary,
                });
                if ('error' in res) {
                    setGateError(res.error);
                    return;
                }
                setKey(key);
                setUnlocked(true);
                setKeyExists(true);
                setStatusMsg('Vault created and unlocked.');
            } catch (e) {
                setGateError(e instanceof Error ? e.message : 'Could not create the vault.');
            } finally {
                setGateBusy(false);
            }
        },
        [setKey],
    );

    /* ── UNLOCK: derive key, verify canary, decrypt metas ───────────────── */

    const handleUnlock = React.useCallback(
        async (password: string) => {
            if (!initialSalt || !initialCanary) {
                setGateError('This vault is missing its key material. Contact support.');
                return;
            }
            setGateBusy(true);
            setGateError(null);
            try {
                const salt = base64ToBytes(initialSalt);
                const key = await deriveMasterKey(password, salt);
                const ok = await verifyCanary(initialCanary, key);
                if (!ok) {
                    setGateError('Wrong password. Try again.');
                    return;
                }
                setKey(key);
                setUnlocked(true);
                setStatusMsg('Vault unlocked.');
                await decryptAllMetas(key, nodes);
            } catch (e) {
                setGateError(e instanceof Error ? e.message : 'Could not unlock the vault.');
            } finally {
                setGateBusy(false);
            }
        },
        [initialSalt, initialCanary, nodes, decryptAllMetas, setKey],
    );

    /* ── UPLOAD: encrypt -> presign -> XHR PUT (progress) -> confirm ────── */

    const startUpload = React.useCallback(
        async (file: File) => {
            const key = masterKeyRef.current;
            if (!key) return;

            if (file.size > MAX_VAULT_BYTES) {
                toast({
                    title: 'File too large',
                    description: 'Vault files are limited to 150 MB in this version.',
                    tone: 'warning',
                });
                return;
            }

            const taskId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setUploads((u) => [
                ...u,
                { id: taskId, label: file.name, progress: 0, status: 'encrypting' },
            ]);

            let cipher: Uint8Array;
            let vaultMeta: string;
            try {
                const buf = await file.arrayBuffer();
                cipher = await encryptBytes(buf, key);
                vaultMeta = await encryptPayload(
                    { name: file.name, mime: file.type || 'application/octet-stream', size: file.size },
                    key,
                );
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Encryption failed';
                setUploads((u) => u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: msg } : t)));
                toast({ title: 'Encryption failed', description: msg, tone: 'danger' });
                return;
            }

            const presign = await presignUpload({
                name: 'Encrypted file',
                size: cipher.byteLength,
                mime: 'application/octet-stream',
                parent_id: null,
            });
            if ('error' in presign) {
                setUploads((u) =>
                    u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: presign.error } : t)),
                );
                toast({ title: 'Upload failed', description: presign.error, tone: 'danger' });
                return;
            }

            const putOk = await new Promise<boolean>((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open(presign.method, presign.upload_url);
                for (const [k, v] of Object.entries(presign.headers || {})) {
                    xhr.setRequestHeader(k, v);
                }
                xhr.upload.addEventListener('progress', (e) => {
                    if (!e.lengthComputable) return;
                    const pct = Math.round((e.loaded / e.total) * 100);
                    setUploads((u) =>
                        u.map((t) => (t.id === taskId ? { ...t, status: 'uploading', progress: pct } : t)),
                    );
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(true);
                    } else {
                        setUploads((u) =>
                            u.map((t) =>
                                t.id === taskId
                                    ? { ...t, status: 'error', error: `Storage returned ${xhr.status}` }
                                    : t,
                            ),
                        );
                        resolve(false);
                    }
                });
                xhr.addEventListener('error', () => {
                    setUploads((u) =>
                        u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: 'Network error' } : t)),
                    );
                    resolve(false);
                });
                // Wrap in a Blob so the typed-array ciphertext is sent verbatim.
                xhr.send(new Blob([cipher as unknown as BlobPart]));
            });

            if (!putOk) return;

            const res = await confirmVaultUpload({
                key: presign.key,
                name: 'Encrypted file',
                size: cipher.byteLength,
                mime: 'application/octet-stream',
                vault_meta: vaultMeta,
            });
            if ('error' in res) {
                setUploads((u) =>
                    u.map((t) => (t.id === taskId ? { ...t, status: 'error', error: res.error } : t)),
                );
                toast({ title: 'Upload failed', description: res.error, tone: 'danger' });
                return;
            }

            setUploads((u) => u.map((t) => (t.id === taskId ? { ...t, status: 'done', progress: 100 } : t)));
            setNodes((curr) => [res.node, ...curr]);
            setDisplays((d) => ({
                ...d,
                [res.node.id]: { name: file.name, mime: file.type || 'application/octet-stream' },
            }));
            toast({ title: 'Encrypted and stored', description: file.name, tone: 'success' });
            // Clear finished/errored tasks after a beat so the list stays calm.
            window.setTimeout(() => {
                setUploads((u) => u.filter((t) => t.id !== taskId));
            }, 2500);
        },
        [toast],
    );

    const handleFiles = React.useCallback(
        (list: FileList | File[] | null) => {
            if (!list) return;
            for (const f of Array.from(list)) void startUpload(f);
        },
        [startUpload],
    );

    /* ── DOWNLOAD: fetch ciphertext -> decrypt -> save ──────────────────── */

    const handleDownload = React.useCallback(
        async (node: SabfilesNode) => {
            const key = masterKeyRef.current;
            if (!key) return;
            setBusyId(node.id);
            let objectUrl: string | null = null;
            try {
                const r = await getDownloadUrl(node.id);
                if ('error' in r) {
                    toast({ title: 'Download failed', description: r.error, tone: 'danger' });
                    return;
                }
                const resp = await fetch(r.url);
                if (!resp.ok) {
                    toast({ title: 'Download failed', description: `Storage returned ${resp.status}`, tone: 'danger' });
                    return;
                }
                const buf = await resp.arrayBuffer();
                const plain = await decryptBytes(buf, key);
                const meta = node.vaultMeta
                    ? await decryptPayload<VaultDisplay>(node.vaultMeta, key)
                    : { name: 'Encrypted file', mime: 'application/octet-stream' };

                const blob = new Blob([plain as unknown as BlobPart], {
                    type: meta.mime || 'application/octet-stream',
                });
                objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = meta.name || 'file';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Could not decrypt this file.';
                toast({ title: 'Decryption failed', description: msg, tone: 'danger' });
            } finally {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                setBusyId(null);
            }
        },
        [toast],
    );

    /* ── DELETE: move ciphertext node to trash ──────────────────────────── */

    const handleDelete = React.useCallback(
        async (node: SabfilesNode) => {
            const name = displays[node.id]?.name ?? 'this file';
            setBusyId(node.id);
            const res = await trashNodes([node.id], null);
            setBusyId(null);
            if ('error' in res) {
                toast({ title: 'Delete failed', description: res.error, tone: 'danger' });
                return;
            }
            setNodes((curr) => curr.filter((n) => n.id !== node.id));
            setDisplays((d) => {
                const next = { ...d };
                delete next[node.id];
                return next;
            });
            toast({ title: 'Moved to trash', description: name, tone: 'neutral' });
        },
        [displays, toast],
    );

    /* ── AUTO-LOCK: 15-min inactivity + lock when tab is hidden ─────────── */

    React.useEffect(() => {
        if (!unlocked) return;

        let timer = window.setTimeout(lock, AUTO_LOCK_MS);
        const reset = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(lock, AUTO_LOCK_MS);
        };
        const onVisibility = () => {
            if (document.hidden) lock();
        };

        const activity: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'pointermove'];
        for (const ev of activity) document.addEventListener(ev, reset, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            window.clearTimeout(timer);
            for (const ev of activity) document.removeEventListener(ev, reset);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [unlocked, lock]);

    /* ── Render ─────────────────────────────────────────────────────────── */

    const liveRegion = (
        <p className="sv-sr-only" role="status" aria-live="polite">
            {statusMsg}
        </p>
    );

    if (!unlocked || !masterKey) {
        return (
            <>
                {liveRegion}
                <VaultGate
                    mode={keyExists ? 'unlock' : 'setup'}
                    busy={gateBusy}
                    error={gateError}
                    onCreate={handleCreate}
                    onUnlock={handleUnlock}
                />
            </>
        );
    }

    const activeUploads = uploads.filter((u) => u.status !== 'done');

    return (
        <div className="sv-shell">
            {liveRegion}

            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabFiles</PageEyebrow>
                    <PageTitle>
                        <span className="sv-title">
                            <ShieldCheck size={22} aria-hidden="true" />
                            Sab Vault
                        </span>
                    </PageTitle>
                    <PageDescription>Your zero-knowledge encrypted space.</PageDescription>
                </PageHeaderHeading>
                <div className="sv-header-actions">
                    <Button variant="secondary" iconLeft={Lock} onClick={lock} aria-label="Lock the vault now">
                        Lock
                    </Button>
                </div>
            </PageHeader>

            <p className="sv-banner">
                <ShieldCheck size={15} aria-hidden="true" />
                <span>
                    Files are encrypted on this device before upload, and your master key never
                    reaches our servers. For your safety, the vault auto-locks after 15 minutes of
                    inactivity.
                </span>
            </p>

            <Card padding="none">
                <CardHeader className="sv-card-head">
                    <CardTitle className="sv-card-title">
                        <ShieldCheck size={16} aria-hidden="true" />
                        Encrypted files
                        <Badge tone="neutral" kind="soft">
                            {nodes.length}
                        </Badge>
                    </CardTitle>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="sv-hidden-input"
                        onChange={(e) => {
                            handleFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        iconLeft={FileUp}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Add file
                    </Button>
                </CardHeader>

                <CardBody className="sv-card-body">
                    <div
                        className={`sv-drop${dragging ? ' is-dragging' : ''}`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            handleFiles(e.dataTransfer.files);
                        }}
                    >
                        <UploadCloud size={22} aria-hidden="true" className="sv-drop__icon" />
                        <p className="sv-drop__lede">Drop files here to encrypt and store</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            or choose files
                        </Button>
                    </div>

                    {activeUploads.length > 0 ? (
                        <ul className="sv-tasks" aria-label="Uploads in progress">
                            {activeUploads.map((task) => (
                                <li key={task.id} className="sv-task" data-status={task.status}>
                                    <span className="sv-task__icon" aria-hidden="true">
                                        {task.status === 'error' ? (
                                            <Lock size={14} />
                                        ) : (
                                            <Loader2 size={14} className="sv-spin" />
                                        )}
                                    </span>
                                    <div className="sv-task__main">
                                        <p className="sv-task__label" title={task.label}>
                                            {task.label}
                                        </p>
                                        {task.status === 'error' ? (
                                            <p className="sv-task__err">{task.error}</p>
                                        ) : (
                                            <Progress
                                                value={task.progress}
                                                size="sm"
                                                aria-label={
                                                    task.status === 'encrypting'
                                                        ? `Encrypting ${task.label}`
                                                        : `Uploading ${task.label}`
                                                }
                                            />
                                        )}
                                    </div>
                                    <span className="sv-task__pct">
                                        {task.status === 'encrypting' ? 'Encrypting' : `${task.progress}%`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    <VaultFileList
                        nodes={nodes}
                        displays={displays}
                        busyId={busyId}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                    />
                </CardBody>
            </Card>
        </div>
    );
}
