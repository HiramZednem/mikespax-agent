import {
    Action,
    elizaLogger,
    IAgentRuntime,
    Memory,
    State,
    composeContext,
    generateText,
    cleanJsonResponse,
    parseJSONObjectFromText,
    extractAttributes,
    truncateToCompleteSentence,
    ModelClass,
    HandlerCallback,
    IImageDescriptionService,
    ServiceType,
    stringToUuid,
    TemplateType,
} from "@elizaos/core";
import {
    buildConversationThread,
    twitterMessageHandlerTemplate,
} from "./utils";

async function sendStandardTweet(
    client: any,
    content: string,
    tweetId?: string,
    mediaData?: any[]
) {
    try {
        if (
            process.env.TWITTER_DRY_RUN &&
            process.env.TWITTER_DRY_RUN.toLowerCase() === "true"
        ) {
            elizaLogger.info(
                `Dry run: would have posted tweet: ${content}`
            );
            return true;
        }
        const result = await client.sendTweet(content, tweetId, mediaData);

        const body = await result.json();

        // Check for Twitter API errors
        if (body.errors) {
            const error = body.errors[0];
            elizaLogger.error(
                `Twitter API error (${error.code}): ${error.message}`
            );
            return false;
        }

        // Check for successful tweet creation
        if (!body?.data?.create_tweet?.tweet_results?.result) {
            elizaLogger.error(
                "Failed to post tweet: No tweet result in response"
            );
            return false;
        }

        return body.data.create_tweet.tweet_results.result;
    } catch (error) {
        elizaLogger.error("Error sending standard Tweet:", error);
        throw error;
    }
}

async function generateTweetContent(
    client: any,
    runtime: IAgentRuntime,
    tweetState: any,
    options?: {
        template?: TemplateType;
        context?: string;
    }
): Promise<string> {
    const context = composeContext({
        state: tweetState,
        template: twitterMessageHandlerTemplate,
    });

    const response = await generateText({
        runtime: runtime,
        context: context,
        modelClass: ModelClass.SMALL,
    });

    elizaLogger.log("generate tweet content response:\n" + response);

    // First clean up any markdown and newlines
    const rawTweetContent = cleanJsonResponse(response);

    // Try to parse as JSON first

    let tweetTextForPosting = null;
    let mediaData = null;

    // Try parsing as JSON first
    const parsedResponse = parseJSONObjectFromText(rawTweetContent);
    if (parsedResponse?.text) {
        tweetTextForPosting = parsedResponse.text;
    }

    // Try extracting text attribute
    if (!tweetTextForPosting) {
        const parsingText = extractAttributes(rawTweetContent, ["text"]).text;
        if (parsingText) {
            tweetTextForPosting = truncateToCompleteSentence(
                extractAttributes(rawTweetContent, ["text"]).text,
                this.client.twitterConfig.MAX_TWEET_LENGTH
            );
        }
    }

    // Use the raw text
    if (!tweetTextForPosting) {
        tweetTextForPosting = rawTweetContent;
    }

    const maxTweetLength = 280;
    // Truncate the content to the maximum tweet length specified in the environment settings, ensuring the truncation respects sentence boundaries.
    if (maxTweetLength) {
        tweetTextForPosting = truncateToCompleteSentence(
            tweetTextForPosting,
            maxTweetLength
        );
    }

    const removeQuotes = (str: string) => str.replace(/^['"](.*)['"]$/, "$1");

    const fixNewLines = (str: string) => str.replaceAll(/\\n/g, "\n\n"); //ensures double spaces

    // Final cleaning
    tweetTextForPosting = removeQuotes(fixNewLines(tweetTextForPosting));

    return tweetTextForPosting;
}

async function handleTextOnlyReply(
    tweet: any,
    tweetState: any,
    runtime: IAgentRuntime,
    client: any
) {
    try {
        // Build conversation thread for context
        // const thread = await buildConversationThread(tweet, client, runtime);
        // const formattedConversation = thread
        //     .map(
        //         (t) =>
        //             `@${t.username} (${new Date(
        //                 t.timestamp * 1000
        //             ).toLocaleString()}): ${t.text}`
        //     )
        //     .join("\n\n");

        const formattedConversation = "";
        // Generate image descriptions if present
        const imageDescriptions = [];
        if (tweet.photos?.length > 0) {
            elizaLogger.log("Processing images in tweet for context");
            for (const photo of tweet.photos) {
                const description = await runtime
                    .getService<IImageDescriptionService>(
                        ServiceType.IMAGE_DESCRIPTION
                    )
                    .describeImage(photo.url);
                imageDescriptions.push(description);
            }
        }

        // Handle quoted tweet if present
        let quotedContent = "";
        if (tweet.quotedStatusId) {
            try {
                const quotedTweet = await client.getTweet(
                    tweet.quotedStatusId
                );
                if (quotedTweet) {
                    quotedContent = `\nQuoted Tweet from @${quotedTweet.username}:\n${quotedTweet.text}`;
                }
            } catch (error) {
                elizaLogger.error("Error fetching quoted tweet:", error);
            }
        }

        // Compose rich state with all context
        const enrichedState = await runtime.composeState(
            {
                userId: runtime.agentId,
                roomId: stringToUuid(
                    tweet.conversationId + "-" + runtime.agentId
                ),
                agentId: runtime.agentId,
                content: { text: tweet.text, action: "" },
            },
            {
                currentPost: `From @${tweet.username}: ${tweet.text}`,
                formattedConversation,
                imageContext:
                    imageDescriptions.length > 0
                        ? `\nImages in Tweet:\n${imageDescriptions
                              .map((desc, i) => `Image ${i + 1}: ${desc}`)
                              .join("\n")}`
                        : "",
                quotedContent,
            }
        );

        // Generate and clean the reply content
        const replyText = await generateTweetContent(
            client,
            runtime,
            enrichedState,
            {template: twitterMessageHandlerTemplate}
        );

        if (!replyText) {
            elizaLogger.error("Failed to generate valid reply content");
            return;
        }

        elizaLogger.debug("Final reply text to be sent:", replyText);

        let result;

        result = await sendStandardTweet(client, replyText, tweet.id);

        if (result) {
            elizaLogger.log("Successfully posted reply tweet");

            // Cache generation context for debugging
            await runtime.cacheManager.set(
                `twitter/reply_generation_${tweet.id}.txt`,
                `Context:\n${enrichedState}\n\nGenerated Reply:\n${replyText}`
            );

            // Here i return the tweet link
            const replyUrl = `https://twitter.com/${client.auth.userProfile.username}/status/${result.rest_id}`;
            const content = `\`\`\`${replyText}\`\`\``;
            return { replyUrl, content };

        } else {
            elizaLogger.error("Tweet reply creation failed");
        }
    } catch (error) {
        elizaLogger.error("Error in handleTextOnlyReply:", error);
    }
}

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
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const twitterClient = runtime.clients.twitter?.client?.twitterClient;
            if (!twitterClient) {
                elizaLogger.error("Twitter client not found");
                return;
            }

            // Extract the tweet URL from the message
            const tweetUrl = message.content.text.split("/reply")[1];
            const tweetId = tweetUrl.split("/").pop();

            // Get the tweet content
            const tweet = await twitterClient.getTweet(tweetId);

            const {replyUrl, content} = await handleTextOnlyReply(tweet, state, runtime, twitterClient);


            const response = `[🐦 reply]: ${replyUrl}
${content}`

            if (
                process.env.TWITTER_DRY_RUN &&
                process.env.TWITTER_DRY_RUN.toLowerCase() === "true"
            ) {
                callback({
                    text:`Dry run: would have posted tweet: ${content}`
                });
                return true;
            }

            callback({
                text: response,
            });
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
                    text: "/reply @{{agentName}} https://x.com/elonmusk/status/1889070627908145538",
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
                    text: "/reply @{{agentName}} https://x.com/franperez_co/status/1887193960399229159",
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
