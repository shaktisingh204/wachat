/**
 * Forge block: AWS ELB (Elastic Load Balancing)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/ELB/AwsElb.node.ts
 *
 * Uses AWS SigV4-less query: callers must provide a pre-signed URL or use
 * the action via an internal proxy. This thin wrapper exposes a minimal
 * shape so flows can post the canonical query and obtain results.
 *
 * For correctness against the official ELB API, configure a signed proxy.
 * This block intentionally focuses on the 3 most-used describe ops.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function endpoint(ctx: ForgeActionContext): string {
  const region = asString(ctx.options.region) || 'us-east-1';
  return `https://elasticloadbalancing.${region}.amazonaws.com`;
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.signedAuthHeader);
  if (!token) throw new Error('AWS ELB: signedAuthHeader is required (pre-signed Authorization header)');
  return { Authorization: token };
}

async function loadBalancersList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams({
    Action: 'DescribeLoadBalancers',
    Version: '2015-12-01',
  });
  const res = await apiRequest({
    service: 'AWS ELB',
    method: 'GET',
    url: `${endpoint(ctx)}/?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: ['AWS ELB describe load balancers'] };
}

async function listenersList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const lbArn = asString(ctx.options.loadBalancerArn);
  if (!lbArn) throw new Error('AWS ELB: loadBalancerArn is required');
  const params = new URLSearchParams({
    Action: 'DescribeListeners',
    Version: '2015-12-01',
    LoadBalancerArn: lbArn,
  });
  const res = await apiRequest({
    service: 'AWS ELB',
    method: 'GET',
    url: `${endpoint(ctx)}/?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: [`AWS ELB listeners → ${lbArn}`] };
}

async function targetHealthDescribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const tgArn = asString(ctx.options.targetGroupArn);
  if (!tgArn) throw new Error('AWS ELB: targetGroupArn is required');
  const params = new URLSearchParams({
    Action: 'DescribeTargetHealth',
    Version: '2015-12-01',
    TargetGroupArn: tgArn,
  });
  const res = await apiRequest({
    service: 'AWS ELB',
    method: 'GET',
    url: `${endpoint(ctx)}/?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: [`AWS ELB target health → ${tgArn}`] };
}

const block: ForgeBlock = {
  id: 'forge_aws_elb',
  name: 'AWS ELB',
  description: 'Describe AWS Elastic Load Balancers, listeners and target health.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load_balancers_list',
      label: 'List load balancers',
      fields: [
        { id: 'region', label: 'Region', type: 'text', defaultValue: 'us-east-1' },
        { id: 'signedAuthHeader', label: 'Signed Authorization header', type: 'password', required: true },
      ],
      run: loadBalancersList,
    },
    {
      id: 'listeners_list',
      label: 'List listeners',
      fields: [
        { id: 'region', label: 'Region', type: 'text', defaultValue: 'us-east-1' },
        { id: 'signedAuthHeader', label: 'Signed Authorization header', type: 'password', required: true },
        { id: 'loadBalancerArn', label: 'Load balancer ARN', type: 'text', required: true },
      ],
      run: listenersList,
    },
    {
      id: 'target_health',
      label: 'Describe target health',
      fields: [
        { id: 'region', label: 'Region', type: 'text', defaultValue: 'us-east-1' },
        { id: 'signedAuthHeader', label: 'Signed Authorization header', type: 'password', required: true },
        { id: 'targetGroupArn', label: 'Target group ARN', type: 'text', required: true },
      ],
      run: targetHealthDescribe,
    },
  ],
};

registerForgeBlock(block);
export default block;
