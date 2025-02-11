
import { Action, elizaLogger, IAgentRuntime, Memory, State, composeContext, generateText, cleanJsonResponse, parseJSONObjectFromText, extractAttributes, truncateToCompleteSentence, ModelClass, HandlerCallback, IImageDescriptionService, ServiceType } from "@elizaos/core";



const tweetTemplate = `
# Context

# Post Directions
{{postDirections}}

**REQUESTED TOPIC MESSAGE TO TWEET ABOUT: {{requestedTopic}}**

# Task
Generate a tweet that:
1. Relates to requested topic
2. Matches the character's style and voice
3. Is concise and engaging
4. Must be UNDER 180 characters (this is a strict requirement)
5. Speaks from the perspective of {{agentName}}

Generate only the tweet text, no other commentary.

Return the tweet in JSON format like: {"text": "your tweet here"}`;



export const replyAction: Action = {
    suppressInitialMessage: true,
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
        callback?: HandlerCallback,
    ): Promise<boolean> => {
        try {
            // Generate tweet content using context
            elizaLogger.info("Generating tweet content...");


            const twitterClient = runtime.clients.twitter?.client?.twitterClient;
            if (!twitterClient) {
                elizaLogger.error("Twitter client not found");
                return;
            } 

            // Extract the tweet URL from the message
            const tweetUrl = message.content.text.split("/reply")[1];
            const tweetId = tweetUrl.split("/").pop();
            const tweet = await twitterClient.getTweet(tweetId);
            

            // Get the tweet content



            callback({text:`The url of the tweet is ${tweetUrl} and the main text is ${tweet.text}`});
        } catch (error) {
            elizaLogger.error("Error in post action:", error);
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "/reply @{{agentName}} https://x.com/elonmusk/status/1889070627908145538" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll reply right away!",
                    action: "REPLY_ACTION", 
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "/reply @{{agentName}} https://x.com/franperez_co/status/1887193960399229159" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Generating a reply.",
                    action: "REPLY_ACTION",
                },
            },
        ],
    ],
};