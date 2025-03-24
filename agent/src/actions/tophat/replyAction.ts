import {
    Action,
    elizaLogger,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
} from "@elizaos/core";
import { TwitterPostClient } from "../../../../packages/client-twitter/src/post";
import { Scraper, Tweet } from "agent-twitter-client";


/**
 * La accion de responder, no manda un tweet directamente, lo unico que hace es que procesa el tweet 
 * y lo manda a la cola de aprobacion. 
 */
export const replyAction: Action = {
    name: "REPLY_ACTION",
    similes: ["REPLY"],
    description: "Handle a https link and reply to it",
    validate: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ) => {
        const username = runtime.getSetting("TWITTER_USERNAME");
        const password = runtime.getSetting("TWITTER_PASSWORD");
        const email = runtime.getSetting("TWITTER_EMAIL");
        const hasCredentials = !!username && !!password && !!email;
        elizaLogger.log(`Has credentials: ${hasCredentials}`);

        return hasCredentials;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const twitterPostClient: TwitterPostClient = runtime.clients.twitter?.post;
            const twitterClient: Scraper = runtime.clients.twitter?.client?.twitterClient;
            if (!twitterClient) {
                elizaLogger.error("Twitter client not found");
                return;
            }

            // Extract the tweet URL from the message
            const tweetUrl = message.content.text.split("/reply")[1];
            const tweetId = tweetUrl.split("/").pop();

            // Get the tweet content
            const tweet: Tweet = await twitterClient.getTweet(tweetId);

            twitterPostClient.handleTextOnlyReply(tweet, state);

        } catch (error) {
            elizaLogger.error("Error in reply action:", error);
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "@{{agentName}} /reply https://x.com/elonmusk/status/1889070627908145538",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "",
                    action: "REPLY_ACTION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "@{{agentName}} /reply https://x.com/franperez_co/status/1887193960399229159",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "",
                    action: "REPLY_ACTION",
                },
            },
        ],
    ],
};
