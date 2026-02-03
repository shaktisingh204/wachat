
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MetaFlowPreview } from "@/components/wabasimplify/meta-flow-preview";
import { Smartphone, Code } from "lucide-react";

interface MetaFlowCanvasProps {
    flowData: any;
    setFlowData: (data: any) => void;
    selectedScreenId: string | null;
}

export function MetaFlowCanvas({
    flowData,
    setFlowData,
    selectedScreenId
}: MetaFlowCanvasProps) {
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [jsonString, setJsonString] = useState("");

    // Sync JSON string when flowData changes externally (unless we are editing it)
    useEffect(() => {
        setJsonString(JSON.stringify(flowData, null, 2));
    }, [flowData]);

    const handleJsonChange = (val: string) => {
        setJsonString(val);
        try {
            const parsed = JSON.parse(val);
            setFlowData(parsed);
            setJsonError(null);
        } catch (e) {
            setJsonError((e as Error).message);
        }
    };

    return (
        <div className="h-full bg-muted/20 flex flex-col">
            <Tabs defaultValue="visual" className="flex-1 flex flex-col">
                <div className="border-b bg-background px-4">
                    <TabsList className="h-10 bg-transparent p-0">
                        <TabsTrigger
                            value="visual"
                            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-4"
                        >
                            <Smartphone className="h-4 w-4 mr-2" />
                            Visual Preview
                        </TabsTrigger>
                        <TabsTrigger
                            value="json"
                            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-4"
                        >
                            <Code className="h-4 w-4 mr-2" />
                            JSON Editor
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="visual" className="flex-1 m-0 p-0 overflow-auto relative bg-muted/20">
                    <div className="min-h-full w-full flex items-center justify-center p-4">
                        <MetaFlowPreview
                            flowJson={JSON.stringify(flowData)}
                            activeScreenId={selectedScreenId}
                            className="w-[390px] h-[844px] shadow-2xl rounded-[3rem] border-[8px] border-gray-900"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="json" className="flex-1 m-0 p-0 relative flex flex-col">
                    <div className="flex-1 relative">
                        <Textarea
                            value={jsonString}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            className="absolute inset-0 w-full h-full resize-none font-mono text-xs p-4 rounded-none border-0 focus-visible:ring-0"
                            spellCheck={false}
                        />
                    </div>
                    {jsonError && (
                        <div className="bg-destructive/10 text-destructive text-sm p-2 border-t border-destructive/20 font-mono">
                            Error: {jsonError}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
