import dotenv from "dotenv";
import { App } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import { createAppAuth } from "@octokit/auth-app";
import fs from "fs";
import http from "http";
import { graphql } from "@octokit/graphql";

dotenv.config();

const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const installationId = process.env.INSTALLATION_ID;

const app = new App({
  appId: appId,
  privateKey: privateKey,
  webhooks: {
    secret: webhookSecret,
  },
});

const auth = createAppAuth({
  appId: appId,
  privateKey: privateKey,
  installationId: installationId,
});
const graphqlWithAuth = graphql.defaults({
  request: {
    hook: auth.hook,
  },
});

app.webhooks.on("issue_comment.created", async ({ octokit, payload }) => {
  const commentBody = payload.comment.body;
  const issueNodeId = payload.issue.node_id;
  console.log(commentBody);
  console.log(issueNodeId);

  // if (!commentBody.includes("@khiga8")) return;

  // Make GraphQL request to see if issue is associated with project items we care about
  const data = await graphqlWithAuth(`
  {
    node(id: "${issueNodeId}") {
      ... on Issue {
        title
        projectItems(first: 5) {
          nodes {
            project {
              url
              title
            }
          }
        }
      }
    }
  }`);

  // If there is a project item in the board we're looking for that is in the `Done` column, move the card.
});

app.webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
  } else {
    console.error(error);
  }
});

const port = 3000;
const host = "localhost";
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

const middleware = createNodeMiddleware(app.webhooks, { path });

http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`);
  console.log("Press Ctrl + C to quit.");
});
