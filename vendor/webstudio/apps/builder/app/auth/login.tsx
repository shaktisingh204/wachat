import { TooltipProvider } from "@radix-ui/react-tooltip";
import {
  Button,
  Flex,
  globalCss,
  rawTheme,
  Text,
  theme,
} from "@webstudio-is/design-system";
import { WebstudioIcon } from "@webstudio-is/icons";
import { SecretLogin } from "./secret-login";

const globalStyles = globalCss({
  body: {
    margin: 0,
    overflow: "hidden",
  },
});

export type LoginProps = {
  errorMessage?: string;
  isSecretLoginEnabled?: boolean;
  devPlanNames?: string[];
  sabnodeUrl?: string;
};

export const Login = ({
  errorMessage,
  isSecretLoginEnabled,
  devPlanNames,
  sabnodeUrl,
}: LoginProps) => {
  globalStyles();
  return (
    <Flex
      align="center"
      justify="center"
      css={{
        height: "100vh",
        background: theme.colors.brandBackgroundDashboard,
      }}
    >
      <Flex
        direction="column"
        align="center"
        gap="6"
        css={{
          width: theme.spacing[35],
          minWidth: theme.spacing[20],
          padding: theme.spacing[17],
          borderRadius: theme.spacing[5],
          [`@media (min-width: ${rawTheme.spacing[35]})`]: {
            backgroundColor: `rgba(255, 255, 255, 0.5)`,
          },
        }}
      >
        <WebstudioIcon size={48} />
        <Text variant="brandSectionTitle" as="h1" align="center">
          Welcome to SabSites
        </Text>

        <TooltipProvider>
          <Flex direction="column" gap="3" css={{ width: "100%" }}>
            <Button
              color="primary"
              css={{ height: theme.spacing[15] }}
              onClick={() => {
                window.location.assign(
                  `${sabnodeUrl ?? ""}/dashboard/website-builder`
                );
              }}
            >
              Continue with SabNode
            </Button>
            {isSecretLoginEnabled && (
              <SecretLogin devPlanNames={devPlanNames} />
            )}
          </Flex>
        </TooltipProvider>
        {errorMessage ? (
          <Text align="center" color="destructive">
            {errorMessage}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  );
};
