import { useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { VariableOption } from '@/lib/sabflow/editor/autocomplete';
import { getForgeBlockMetadataSync } from '@/lib/sabflow/forge/metadata-client';


export function useContextVariables(nodeId?: string): VariableOption[] {
  const rf = useReactFlow();

  return useMemo(() => {
    if (!nodeId) return [];
    
    const nodes = rf.getNodes();
    const edges = rf.getEdges();

    const variables: VariableOption[] = [
      { label: '$json', type: 'variable', info: 'Current item payload' },
      { label: '$prev', type: 'variable', info: 'Previous node output' }
    ];

    // Find all immediate incoming edges
    const incomingEdges = edges.filter(e => e.target === nodeId);
    const incomingNodeIds = incomingEdges.map(e => e.source);

    for (const id of incomingNodeIds) {
      const sourceNode = nodes.find(n => n.id === id);
      if (!sourceNode) continue;

      const type = sourceNode.data?.type || (sourceNode as any).type;
      if (!type) continue;

      if (type.startsWith('forge_')) {
        const metadata = getForgeBlockMetadataSync(type);
        if (metadata) {
          // If the forge block has a defined name, expose it
          variables.push({
            label: `$('${metadata.name}').item.json`,
            type: 'variable',
            info: `Output from ${metadata.name}`
          });
          
          // Optionally, we could statically introspect metadata.outputs if the schema defined it
          // Or we can add standard expressions for upstream node
          variables.push({
            label: `$('${metadata.name}').first().json`,
            type: 'variable',
            info: `First item from ${metadata.name}`
          });
        }
      }
    }

    // Always include $runIndex etc
    variables.push({ label: '$runIndex', type: 'keyword', info: 'Current loop index' });
    variables.push({ label: '$workflow.id', type: 'keyword', info: 'Workflow ID' });
    variables.push({ label: '$workflow.name', type: 'keyword', info: 'Workflow Name' });

    return variables;
  }, [nodeId, rf]);
}
