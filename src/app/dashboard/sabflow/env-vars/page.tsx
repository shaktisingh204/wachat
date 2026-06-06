"use client"

import React, { useState } from "react"
import { Plus, Search, Eye, EyeOff, MoreHorizontal, Copy, Check, Shield } from "lucide-react"

import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';import { Button } from '@/components/sabcrm/20ui/compat';import { Badge } from '@/components/sabcrm/20ui/compat';import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/sabcrm/20ui/compat';import { Input } from '@/components/sabcrm/20ui/compat';import { Label } from '@/components/sabcrm/20ui/compat';import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';type EnvVar = {
  id: string
  key: string
  value: string
  scope: "Production" | "Preview" | "Development" | "Global"
  lastUpdated: string
}

const initialEnvVars: EnvVar[] = [
  { id: '1', key: 'NEXT_PUBLIC_API_URL', value: 'https://api.example.com', scope: 'Global', lastUpdated: '2 hours ago' },
  { id: '2', key: 'DATABASE_URL', value: 'postgres://user:pass@db.example.com:5432/db', scope: 'Production', lastUpdated: '1 week ago' },
  { id: '3', key: 'STRIPE_SECRET_KEY', value: 'sk_test_1234567890abcdef', scope: 'Development', lastUpdated: '3 days ago' },
  { id: '4', key: 'OPENAI_API_KEY', value: 'sk-abcdef1234567890', scope: 'Production', lastUpdated: '2 weeks ago' },
  { id: '5', key: 'REDIS_URL', value: 'redis://redis.example.com:6379', scope: 'Preview', lastUpdated: '1 month ago' },
  { id: '6', key: 'GITHUB_OAUTH_CLIENT_ID', value: 'iv1.1234567890', scope: 'Global', lastUpdated: '2 days ago' },
  { id: '7', key: 'AWS_ACCESS_KEY_ID', value: 'AKIAIOSFODNN7EXAMPLE', scope: 'Production', lastUpdated: '1 month ago' },
  { id: '8', key: 'AWS_SECRET_ACCESS_KEY', value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', scope: 'Production', lastUpdated: '1 month ago' },
]

export default function EnvVarsPage() {
  const [envVars, setEnvVars] = useState<EnvVar[]>(initialEnvVars)
  const [searchTerm, setSearchTerm] = useState("")
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const toggleReveal = (id: string) => {
    const newRevealed = new Set(revealedKeys)
    if (newRevealed.has(id)) {
      newRevealed.delete(id)
    } else {
      newRevealed.add(id)
    }
    setRevealedKeys(newRevealed)
  }

  const copyToClipboard = (value: string, id: string) => {
    navigator.clipboard.writeText(value)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const filteredVars = envVars.filter(v => v.key.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-[var(--st-text)]" />
            Environment Variables
          </h1>
          <p className="text-[var(--st-text-secondary)] mt-2 max-w-2xl">
            Securely manage environment variables and secrets across different deployment scopes.
            Values are encrypted at rest.
          </p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
              <Plus className="h-4 w-4" />
              Add Variable
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Environment Variable</DialogTitle>
              <DialogDescription>
                Create a new environment variable. Changes will be applied on the next deployment.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="grid gap-2">
                <Label htmlFor="key">Key</Label>
                <Input id="key" placeholder="e.g. NEXT_PUBLIC_API_URL" className="font-mono text-sm" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="value">Value</Label>
                <Input id="value" type="password" placeholder="e.g. https://api.example.com" className="font-mono text-sm" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scope">Scope</Label>
                <Select defaultValue="development">
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="preview">Preview</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">Save Variable</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-[var(--st-border)]/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-[var(--st-bg-muted)]/30 border-b">
          <CardTitle>Configured Variables</CardTitle>
          <CardDescription>
            A list of all environment variables configured for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 border-b bg-[var(--st-bg-secondary)]">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
              <Input
                type="search"
                placeholder="Search keys..."
                className="pl-9 bg-[var(--st-bg-secondary)] shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <THead className="bg-[var(--st-bg-muted)]/30">
                <Tr className="hover:bg-transparent">
                  <Th className="w-[280px]">Variable Name</Th>
                  <Th>Value</Th>
                  <Th>Scope</Th>
                  <Th>Last Updated</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredVars.map((envVar) => {
                  const isRevealed = revealedKeys.has(envVar.id)
                  
                  let badgeVariant: "default" | "secondary" | "success" | "warning" | "info" | "prism" = "default"
                  if (envVar.scope === "Production") badgeVariant = "success"
                  if (envVar.scope === "Preview") badgeVariant = "info"
                  if (envVar.scope === "Development") badgeVariant = "warning"
                  if (envVar.scope === "Global") badgeVariant = "prism"
                  
                  return (
                    <Tr key={envVar.id} className="group transition-colors hover:bg-[var(--st-bg-muted)]/50">
                      <Td className="font-mono text-sm font-medium">
                        {envVar.key}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <code className="relative rounded bg-[var(--st-bg-muted)]/50 px-[0.4rem] py-[0.3rem] font-mono text-sm max-w-[250px] truncate border border-[var(--st-border)]/50 shadow-sm">
                            {isRevealed ? envVar.value : "••••••••••••••••••••"}
                          </code>
                          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                              onClick={() => toggleReveal(envVar.id)}
                            >
                              {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              <span className="sr-only">Toggle visibility</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                              onClick={() => copyToClipboard(envVar.value, envVar.id)}
                            >
                              {copiedKey === envVar.id ? <Check className="h-4 w-4 text-[var(--st-text)]" /> : <Copy className="h-4 w-4" />}
                              <span className="sr-only">Copy value</span>
                            </Button>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge variant={badgeVariant} className="shadow-sm">{envVar.scope}</Badge>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)] text-sm">
                        {envVar.lastUpdated}
                      </Td>
                      <Td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => copyToClipboard(envVar.key, envVar.id)}>
                              Copy Key
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyToClipboard(envVar.value, envVar.id)}>
                              Copy Value
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-[var(--st-text)]">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  )
                })}
                {filteredVars.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="h-32 text-center text-[var(--st-text-secondary)]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Shield className="h-8 w-8 opacity-20" />
                        <p>No environment variables found matching "{searchTerm}"</p>
                      </div>
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
