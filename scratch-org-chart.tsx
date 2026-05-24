function OrgChart({ members, pendingEmails }: { members: MemberRow[], pendingEmails: Set<string> }) {
    const roles = ['owner', 'admin', 'agent', 'member'];
    
    return (
        <div className="flex flex-col items-center p-8 gap-8 bg-muted/10 rounded-lg border border-border mt-4">
            {roles.map(role => {
                const group = members.filter(m => deriveRole(m) === role);
                if (group.length === 0) return null;
                return (
                    <div key={role} className="flex flex-col items-center relative w-full">
                        <div className="mb-4 font-semibold capitalize text-muted-foreground text-sm tracking-widest">{role}s</div>
                        <div className="flex flex-wrap justify-center gap-4">
                            {group.map(member => (
                                <Card key={member._id.toString()} className="w-48 p-4 flex flex-col items-center gap-2 shadow-sm relative z-10 bg-background">
                                    <Avatar className="w-12 h-12">
                                        <ZoruAvatarImage src={`https://i.pravatar.cc/150?u=${member.email}`} />
                                        <ZoruAvatarFallback>{member.name?.slice(0, 2).toUpperCase() || 'UN'}</ZoruAvatarFallback>
                                    </Avatar>
                                    <div className="text-center">
                                        <p className="text-sm font-medium leading-none mb-1">{member.name || member.email.split('@')[0]}</p>
                                        <p className="text-xs text-muted-foreground truncate w-40" title={member.email}>{member.email}</p>
                                    </div>
                                    <StatusBadge status={deriveStatus(member, pendingEmails)} />
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
