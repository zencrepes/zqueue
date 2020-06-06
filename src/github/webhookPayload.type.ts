export interface GithubNode {
  node_id: string;
}

export interface WebhookPayload {
  action: string;
  issue?: GithubNode;
  label?: GithubNode;
  milestine?: GithubNode;
}
