import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { fmtDate } from "@/lib/utils";
export const dynamic = 'force-dynamic';

import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  PageHeader,
  Button,
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Badge,
  Separator,
  EmptyState
} from '@/components/sabcrm/20ui/compat';
import Link from 'next/link';
import { Shield, Building2, Key, Clock, ChevronRight, Settings, LayoutDashboard, Globe } from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'My Account | SabNode',
};

export default async function UserDashboardPage() {
  const session = await getCachedSession();
  
  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user;
  const projects = await getCachedProjects() || [];
  
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : user.email.substring(0, 2).toUpperCase();

  const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Unknown';

  const hasPassword = !!user.password;
  const apiKeysCount = user.apiKeys?.length || 0;
  
  const activeProject = projects.find(p => p._id?.toString() === user.activeProjectId?.toString()) || projects[0];

  return (
    <div className="container py-8 max-w-6xl mx-auto space-y-8">
      <PageHeader 
        title="My Account" 
        description="Overview of your profile, security, and workspaces." 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <ZoruCardHeader>
            <ZoruCardTitle className="text-xl">Profile Information</ZoruCardTitle>
            <ZoruCardDescription>Your personal identity on SabNode.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <Avatar className="h-24 w-24">
              <ZoruAvatarImage src={user.image || ''} alt={user.name || 'User'} />
              <ZoruAvatarFallback className="text-2xl">{initials}</ZoruAvatarFallback>
            </Avatar>
            <div className="space-y-2 flex-1">
              <h3 className="text-2xl font-semibold tracking-tight">{user.name || 'Anonymous User'}</h3>
              <p className="text-[var(--st-text-secondary)]">{user.email}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Joined {joinedDate}
                </Badge>
                {user.language && (
                  <Badge variant="outline">
                    Language: {user.language.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          </ZoruCardContent>
          <Separator />
          <ZoruCardFooter className="pt-6">
            <Button asChild variant="outline">
              <Link href="/dashboard/user/settings/profile">
                <Settings className="w-4 h-4 mr-2" />
                Manage Profile
              </Link>
            </Button>
          </ZoruCardFooter>
        </Card>

        {/* Security Overview */}
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--st-text)]" />
              Security
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--st-text-secondary)]" />
                <span className="text-sm font-medium">Password</span>
              </div>
              <Badge variant={hasPassword ? "default" : "destructive"}>
                {hasPassword ? "Set" : "Not Set"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-[var(--st-text-secondary)]" />
                <span className="text-sm font-medium">API Keys</span>
              </div>
              <span className="text-sm text-[var(--st-text-secondary)]">{apiKeysCount} active</span>
            </div>
          </ZoruCardContent>
          <Separator />
          <ZoruCardFooter className="pt-6">
             <Button asChild variant="ghost" className="w-full justify-between">
              <Link href="/dashboard/user/settings/profile">
                Security Settings <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </ZoruCardFooter>
        </Card>
        
        {/* Business Profile */}
        <Card className="md:col-span-2">
          <ZoruCardHeader>
            <ZoruCardTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--st-text)]" />
              Business Profile
            </ZoruCardTitle>
            <ZoruCardDescription>Information about your company or organization.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {user.businessProfile ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-[var(--st-text-secondary)]">Business Name</dt>
                  <dd className="mt-1 text-sm font-semibold">{user.businessProfile.name || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--st-text-secondary)]">GSTIN</dt>
                  <dd className="mt-1 text-sm">{user.businessProfile.gstin || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--st-text-secondary)]">PAN</dt>
                  <dd className="mt-1 text-sm">{user.businessProfile.pan || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-[var(--st-text-secondary)]">Address</dt>
                  <dd className="mt-1 text-sm">{user.businessProfile.address || 'Not provided'}</dd>
                </div>
              </dl>
            ) : (
              <EmptyState 
                icon={<Building2 className="w-12 h-12 text-[var(--st-text-secondary)]/50" />}
                title="No Business Profile"
                description="You haven't set up your business profile yet."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/user/settings/profile">Setup Business Profile</Link>
                  </Button>
                }
              />
            )}
          </ZoruCardContent>
        </Card>

        {/* Workspace Info */}
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-xl flex items-center gap-2">
              <Globe className="w-5 h-5 text-[var(--st-text)]" />
              Workspaces
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
             <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--st-text-secondary)]">Total Workspaces</span>
                <span className="text-2xl font-bold">{projects.length}</span>
             </div>
             {activeProject && (
               <div className="p-3 bg-[var(--st-bg-muted)] rounded-md border text-sm">
                 <p className="font-medium text-[var(--st-text-secondary)] mb-1">Active Workspace</p>
                 <p className="font-semibold truncate" title={activeProject.name}>{activeProject.name}</p>
               </div>
             )}
          </ZoruCardContent>
          <Separator />
          <ZoruCardFooter className="pt-6">
             <Button asChild variant="ghost" className="w-full justify-between">
              <Link href="/dashboard/platform">
                Manage Workspaces <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </ZoruCardFooter>
        </Card>
      </div>
    </div>
  );
}
