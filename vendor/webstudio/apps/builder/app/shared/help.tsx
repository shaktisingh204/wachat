import { ContentIcon, LifeBuoyIcon } from "@webstudio-is/icons";

export const socialLinks = [] as const;

export const help = [
  {
    label: "SabNode Help Center",
    url: "https://sabnode.com/help",
    icon: <LifeBuoyIcon />,
  },
  {
    label: "Docs",
    url: "https://sabnode.com/docs/sabsites",
    icon: <ContentIcon />,
  },
] as const;
