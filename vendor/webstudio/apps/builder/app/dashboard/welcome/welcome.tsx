import { Flex, Text, Link, buttonStyle } from "@webstudio-is/design-system";
import { useStore } from "@nanostores/react";
import { Main } from "../shared/layout";
import { CreateProject } from "../projects/project-dialogs";
import { $permissions } from "~/shared/nano-states";

export const Welcome = ({
  currentWorkspaceId,
}: {
  currentWorkspaceId?: string;
}) => {
  const permissions = useStore($permissions);
  return (
    <Main>
      <Flex
        direction="column"
        align="center"
        grow
        gap="7"
        css={{ paddingBlock: "20vh" }}
      >
        <Text variant="brandMediumTitle" as="h3">
          Welcome!
        </Text>

        <Flex align="center" gap="3">
          <Link
            className={buttonStyle({ color: "dark" })}
            underline="none"
            href="https://sabnode.com/templates"
            target="_blank"
            color="contrast"
          >
            Start from a template
          </Link>
          {permissions.canCreateProject && (
            <CreateProject
              workspaceId={currentWorkspaceId}
              buttonText="Create a blank project"
            />
          )}
        </Flex>

        <Text variant="regular" color="subtle" css={{ maxWidth: 460 }} align="center">
          Build and publish websites visually with SabSites — start from a
          template or a blank canvas.
        </Text>
      </Flex>
    </Main>
  );
};
