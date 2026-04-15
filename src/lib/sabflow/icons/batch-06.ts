import {
  FileText, HardDrive, FormInput, MapPin, Video, Table2, CheckSquare,
  Globe, Activity, Users2, Headphones, Clock, Cloud, Share2, BarChart2,
  Users, Camera, MessageSquare, RotateCcw, Bug, Braces, Mail, Zap,
} from 'lucide-react';

export const iconBatch06: Record<string, { icon: any; iconColor: string }> = {
  // google-docs*
  'google-docs': { icon: FileText, iconColor: 'text-blue-500' },

  // google-drive*
  'google-drive': { icon: HardDrive, iconColor: 'text-blue-500' },
  'google-drive-enhanced': { icon: HardDrive, iconColor: 'text-blue-500' },

  // google-forms (exact match before google-* catch-all)
  'google-forms': { icon: FormInput, iconColor: 'text-purple-500' },
  'googleforms': { icon: FormInput, iconColor: 'text-purple-500' },
  'googleforms-enhanced': { icon: FormInput, iconColor: 'text-purple-500' },

  // google-maps
  'google-maps': { icon: MapPin, iconColor: 'text-red-500' },

  // google-meet
  'google-meet': { icon: Video, iconColor: 'text-green-500' },

  // google-sheets*
  'google-sheets': { icon: Table2, iconColor: 'text-green-600' },
  'google-sheets-enhanced': { icon: Table2, iconColor: 'text-green-600' },

  // google-tasks
  'google-tasks': { icon: CheckSquare, iconColor: 'text-blue-500' },
  'googletasks': { icon: CheckSquare, iconColor: 'text-blue-500' },

  // google-* catch-all (all remaining google- prefixed)
  'google-ads': { icon: Globe, iconColor: 'text-blue-500' },
  'google-ads-enhanced': { icon: Globe, iconColor: 'text-blue-500' },
  'google-analytics4': { icon: Globe, iconColor: 'text-blue-500' },
  'google-analytics-enhanced': { icon: Globe, iconColor: 'text-blue-500' },
  'google-bigquery': { icon: Globe, iconColor: 'text-blue-500' },
  'google-calendar': { icon: Globe, iconColor: 'text-blue-500' },
  'google-calendar-enhanced': { icon: Globe, iconColor: 'text-blue-500' },
  'google-chat': { icon: Globe, iconColor: 'text-blue-500' },
  'google-classroom': { icon: Globe, iconColor: 'text-blue-500' },
  'google-cloud-dataflow': { icon: Globe, iconColor: 'text-blue-500' },
  'google-cloud-functions': { icon: Globe, iconColor: 'text-blue-500' },
  'google-cloud-storage': { icon: Globe, iconColor: 'text-blue-500' },
  'google-gemini': { icon: Globe, iconColor: 'text-blue-500' },
  'google-gmail-enhanced': { icon: Globe, iconColor: 'text-blue-500' },
  'google-merchant': { icon: Globe, iconColor: 'text-blue-500' },
  'google-pubsub': { icon: Globe, iconColor: 'text-blue-500' },
  'google-search-console': { icon: Globe, iconColor: 'text-blue-500' },
  'google-secret-manager': { icon: Globe, iconColor: 'text-blue-500' },
  'google-tag-manager': { icon: Globe, iconColor: 'text-blue-500' },
  'google-workspace-admin': { icon: Globe, iconColor: 'text-blue-500' },
  'googleads': { icon: Globe, iconColor: 'text-blue-500' },
  'googleanalytics': { icon: Globe, iconColor: 'text-blue-500' },
  'googlecontacts': { icon: Globe, iconColor: 'text-blue-500' },

  // grafana*
  'grafana': { icon: Activity, iconColor: 'text-orange-500' },
  'grafana-enhanced': { icon: Activity, iconColor: 'text-orange-500' },
  'grafanaenhanced': { icon: Activity, iconColor: 'text-orange-500' },

  // greenhouse*
  'greenhouse': { icon: Users2, iconColor: 'text-green-500' },
  'greenhouse-enhanced': { icon: Users2, iconColor: 'text-green-500' },

  // groove
  'groove': { icon: Headphones, iconColor: 'text-blue-500' },

  // gusto*
  'gusto': { icon: Users2, iconColor: 'text-teal-500' },
  'gusto-enhanced': { icon: Users2, iconColor: 'text-teal-500' },

  // harvest
  'harvest': { icon: Clock, iconColor: 'text-orange-500' },
  'harvest-enhanced': { icon: Clock, iconColor: 'text-orange-500' },

  // helpscout*
  'helpscout': { icon: Headphones, iconColor: 'text-teal-500' },
  'helpscout-enhanced': { icon: Headphones, iconColor: 'text-teal-500' },

  // hotjar*
  'hotjar': { icon: BarChart2, iconColor: 'text-orange-500' },

  // hubspot*
  'hubspot': { icon: Users, iconColor: 'text-orange-500' },
  'hubspot-cms': { icon: Users, iconColor: 'text-orange-500' },
  'hubspot-crm': { icon: Users, iconColor: 'text-orange-500' },
  'hubspot-enhanced': { icon: Users, iconColor: 'text-orange-500' },
  'hubspot-meetings': { icon: Users, iconColor: 'text-orange-500' },

  // insightly
  'insightly': { icon: Users, iconColor: 'text-blue-500' },

  // instagram*
  'instagram': { icon: Camera, iconColor: 'text-pink-500' },
  'instagram-enhanced': { icon: Camera, iconColor: 'text-pink-500' },
  'instagram-graph': { icon: Camera, iconColor: 'text-pink-500' },

  // intercom*
  'intercom': { icon: MessageSquare, iconColor: 'text-blue-500' },
  'intercom-enhanced': { icon: MessageSquare, iconColor: 'text-blue-500' },
  'intercom-v3': { icon: MessageSquare, iconColor: 'text-blue-500' },

  // iterator
  'iterator': { icon: RotateCcw, iconColor: 'text-gray-500' },

  // jira*
  'jira': { icon: Bug, iconColor: 'text-blue-500' },
  'jira-enhanced': { icon: Bug, iconColor: 'text-blue-500' },

  // jotform
  'jotform': { icon: FormInput, iconColor: 'text-orange-500' },
  'jotform-enhanced': { icon: FormInput, iconColor: 'text-orange-500' },

  // keap
  'keap': { icon: Mail, iconColor: 'text-green-500' },

  // klaviyo
  'klaviyo': { icon: Mail, iconColor: 'text-blue-500' },
  'klaviyo-enhanced': { icon: Mail, iconColor: 'text-blue-500' },
  'klaviyo-v2': { icon: Mail, iconColor: 'text-blue-500' },
};
