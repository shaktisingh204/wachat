import { Octokit } from "@octokit/rest";

export class GitHubClient {
    private octokit: Octokit;
    private owner: string;
    private repo: string;

    constructor(token: string, owner: string, repo: string) {
        this.octokit = new Octokit({ auth: token });
        this.owner = owner;
        this.repo = repo;
    }

    async createBranch(baseBranch: string, newBranch: string) {
        // Get SHA of base branch
        const { data: ref } = await this.octokit.git.getRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${baseBranch}`,
        });

        // Create new branch
        await this.octokit.git.createRef({
            owner: this.owner,
            repo: this.repo,
            ref: `refs/heads/${newBranch}`,
            sha: ref.object.sha,
        });
    }

    async createOrUpdateFile(branch: string, path: string, content: string, message: string) {
        // Check if file exists to get SHA (for update)
        let sha: string | undefined;
        try {
            const { data: file } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path,
                ref: branch,
            }) as any;
            sha = file.sha;
        } catch (e) {
            // File doesn't exist, create new
        }

        await this.octokit.repos.createOrUpdateFileContents({
            owner: this.owner,
            repo: this.repo,
            path,
            message,
            content: Buffer.from(content).toString('base64'),
            branch,
            sha,
        });
    }

    async openPullRequest(head: string, base: string, title: string, body: string) {
        const { data: pr } = await this.octokit.pulls.create({
            owner: this.owner,
            repo: this.repo,
            head,
            base,
            title,
            body,
        });
        return pr.html_url;
    }
}
