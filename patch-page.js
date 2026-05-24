const fs = require('fs');
const path = './src/app/dashboard/profile/2fa-setup/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Add import for getRecentLoginAttempts and LoginAttempt
code = code.replace(
  'type TwoFactorStatus,',
  'type TwoFactorStatus,\n  getRecentLoginAttempts,\n  type LoginAttempt,'
);

// Add state for login attempts
code = code.replace(
  "const [status, setStatus] = useState<TwoFactorStatus | null>(null);",
  "const [status, setStatus] = useState<TwoFactorStatus | null>(null);\n  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);"
);

// Update refresh logic to also fetch login attempts
const refreshReplacement = `const refresh = useCallback(() => {
    startLoad(async () => {
      const [r, attempts] = await Promise.all([
        getMy2faStatus(),
        getRecentLoginAttempts()
      ]);
      if (r.ok && r.data) setStatus(r.data);
      if (attempts.ok && attempts.data) setLoginAttempts(attempts.data);
    });
  }, []);`;
code = code.replace(/const refresh = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/, refreshReplacement);

// Add the UI component for the Audit Log
const auditLogUI = `
      {isEnabled ? <BackupCodesPanel status={status} /> : null}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle className="text-base">Security Audit Log</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {loginAttempts.length === 0 ? (
            <p className="text-sm text-zoru-ink-muted">No recent login attempts found.</p>
          ) : (
            <div className="space-y-4">
              {loginAttempts.map((attempt) => (
                <div key={attempt._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zoru-line pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {attempt.ip}
                      <Badge variant={attempt.status === 'success' ? 'default' : attempt.status === 'pending_2fa' ? 'outline' : 'destructive'}>
                        {attempt.status === 'success' ? 'Success' : attempt.status === 'pending_2fa' ? '2FA Pending' : 'Failed'}
                      </Badge>
                    </p>
                    <p className="text-xs text-zoru-ink-muted truncate max-w-sm mt-1" title={attempt.userAgent}>
                      {attempt.userAgent}
                    </p>
                  </div>
                  <div className="text-xs text-zoru-ink-muted sm:text-right whitespace-nowrap">
                    {new Date(attempt.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ZoruCardContent>
      </Card>
`;

code = code.replace('{isEnabled ? <BackupCodesPanel status={status} /> : null}', auditLogUI);

fs.writeFileSync(path, code);
