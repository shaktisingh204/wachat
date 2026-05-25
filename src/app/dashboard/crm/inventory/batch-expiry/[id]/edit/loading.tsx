import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex min-h-[400px] w-full items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <h3 className="text-lg font-medium">Loading Batch Editor</h3>
        <p className="text-sm text-muted-foreground">
          Please wait while we load the batch details...
        </p>
      </div>
    </div>
  )
}
