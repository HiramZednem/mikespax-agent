import { Action, elizaLogger, IAgentRuntime, Memory, State, composeContext, generateText, cleanJsonResponse, parseJSONObjectFromText, extractAttributes, truncateToCompleteSentence, ModelClass } from "@elizaos/core";



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

async function composeTweet(
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State
) {
    
    const requestedTopic = _message.content.text;
    state.requestedTopic = requestedTopic;

    const context = composeContext({
        state,
        template: tweetTemplate,
    });

    elizaLogger.info(`context: ${context}`)


    const response = await generateText({
        runtime: runtime,
        context,
        modelClass: ModelClass.SMALL,
    });

    const rawTweetContent = cleanJsonResponse(response);

    // First attempt to clean content
    let tweetTextForPosting = null;
    let mediaData = null;

    // Try parsing as JSON first
    const parsedResponse = parseJSONObjectFromText(rawTweetContent);
    if (parsedResponse?.text) {
        tweetTextForPosting = parsedResponse.text;
    }

    // if (
    //     parsedResponse?.attachments &&
    //     parsedResponse?.attachments.length > 0
    // ) {
    //     mediaData = await fetchMediaData(parsedResponse.attachments);
    // }

    // Try extracting text attribute
    if (!tweetTextForPosting) {
        const parsingText = extractAttributes(rawTweetContent, [
            "text",
        ]).text;
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

    const maxTweetLength = 280
    // Truncate the content to the maximum tweet length specified in the environment settings, ensuring the truncation respects sentence boundaries.
    if (maxTweetLength) {
        tweetTextForPosting = truncateToCompleteSentence(
            tweetTextForPosting,
            maxTweetLength
        );
    }

    const removeQuotes = (str: string) =>
        str.replace(/^['"](.*)['"]$/, "$1");

    const fixNewLines = (str: string) => str.replaceAll(/\\n/g, "\n\n"); //ensures double spaces

    // Final cleaning
    tweetTextForPosting = removeQuotes(
        fixNewLines(tweetTextForPosting)
    );

    return tweetTextForPosting;
}

export const postTweetAction: Action = {
    name: "POST_TWEET",
    similes: ["TWEET", "POST", "SEND_TWEET"],
    description: "Post a tweet to Twitter",
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
        state?: State
    ): Promise<boolean> => {
        try {
            // Generate tweet content using context
            elizaLogger.info("Generating tweet content...");
            const tweetContent = await composeTweet(runtime, message, state);

            if (!tweetContent) {
                elizaLogger.error("No content generated for tweet");
                return false;
            }

            elizaLogger.log(`Generated tweet content: ${tweetContent}`);

            // Check for dry run mode - explicitly check for string "true"
            if (
                process.env.TWITTER_DRY_RUN &&
                process.env.TWITTER_DRY_RUN.toLowerCase() === "true"
            ) {
                elizaLogger.info(
                    `Dry run: would have posted tweet: ${tweetContent}`
                );
                return true;
            }

            // TODO: I NEED TO ADD THE PART TO POST THE TWEET

            // return await postTweet(runtime, tweetContent);
        } catch (error) {
            elizaLogger.error("Error in post action:", error);
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "You should tweet that" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll share this update with my followers right away!",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Post this tweet" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post that as a tweet now.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Share that on Twitter" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll share this message on Twitter.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Post that on X" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll post this message on X right away.",
                    action: "POST_TWEET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "You should put that on X dot com" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I'll put this message up on X.com now.",
                    action: "POST_TWEET",
                },
            },
        ],
    ],
};