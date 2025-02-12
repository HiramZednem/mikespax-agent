import { elizaLogger, getEmbeddingZeroVector, messageCompletionFooter, stringToUuid } from "@elizaos/core";

export const twitterMessageHandlerTemplate =
`
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

{{recentPosts}}

# TASK: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}) while using the thread of tweets as additional context:

Current Post:
{{currentPost}}
Here is the descriptions of images in the Current post.
{{imageDescriptions}}

Thread of Tweets You Are Replying To:
{{formattedConversation}}

# INSTRUCTIONS: Generate a post in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}). You MUST include an action if the current post text includes a prompt that is similar to one of the available actions mentioned here:
{{actionNames}}
{{actions}}

Here is the current post text again. Remember to include an action if the current post text includes a prompt that asks for one of the available actions mentioned above (does not need to be exact)
{{currentPost}}
Here is the descriptions of images in the Current post.
{{imageDescriptions}}
` + messageCompletionFooter;


export async function buildConversationThread(
    tweet: any,
    client: any,
    maxReplies = 10
): Promise<any[]> {
    const thread: any[] = [];
    const visited: Set<string> = new Set();

    async function processThread(currentTweet: any, depth = 0) {
        elizaLogger.debug("Processing tweet:", {
            id: currentTweet.id,
            inReplyToStatusId: currentTweet.inReplyToStatusId,
            depth: depth,
        });

        if (!currentTweet) {
            elizaLogger.debug("No current tweet found for thread building");
            return;
        }

        // Stop if we've reached our reply limit
        if (depth >= maxReplies) {
            elizaLogger.debug("Reached maximum reply depth", depth);
            return;
        }

        // Handle memory storage
        const memory = await client.runtime.messageManager.getMemoryById(
            stringToUuid(currentTweet.id + "-" + client.runtime.agentId)
        );
        if (!memory) {
            const roomId = stringToUuid(
                currentTweet.conversationId + "-" + client.runtime.agentId
            );
            const userId = stringToUuid(currentTweet.userId);

            await client.runtime.ensureConnection(
                userId,
                roomId,
                currentTweet.username,
                currentTweet.name,
                "twitter"
            );

            await client.runtime.messageManager.createMemory({
                id: stringToUuid(
                    currentTweet.id + "-" + client.runtime.agentId
                ),
                agentId: client.runtime.agentId,
                content: {
                    text: currentTweet.text,
                    source: "twitter",
                    url: currentTweet.permanentUrl,
                    inReplyTo: currentTweet.inReplyToStatusId
                        ? stringToUuid(
                              currentTweet.inReplyToStatusId +
                                  "-" +
                                  client.runtime.agentId
                          )
                        : undefined,
                },
                createdAt: currentTweet.timestamp * 1000,
                roomId,
                userId:
                    currentTweet.userId === client.profile.id
                        ? client.runtime.agentId
                        : stringToUuid(currentTweet.userId),
                embedding: getEmbeddingZeroVector(),
            });
        }

        if (visited.has(currentTweet.id)) {
            elizaLogger.debug("Already visited tweet:", currentTweet.id);
            return;
        }

        visited.add(currentTweet.id);
        thread.unshift(currentTweet);

        elizaLogger.debug("Current thread state:", {
            length: thread.length,
            currentDepth: depth,
            tweetId: currentTweet.id,
        });

        // If there's a parent tweet, fetch and process it
        if (currentTweet.inReplyToStatusId) {
            elizaLogger.debug(
                "Fetching parent tweet:",
                currentTweet.inReplyToStatusId
            );
            try {
                const parentTweet = await client.getTweet(
                    currentTweet.inReplyToStatusId
                );

                if (parentTweet) {
                    elizaLogger.debug("Found parent tweet:", {
                        id: parentTweet.id,
                        text: parentTweet.text?.slice(0, 50),
                    });
                    await processThread(parentTweet, depth + 1);
                } else {
                    elizaLogger.debug(
                        "No parent tweet found for:",
                        currentTweet.inReplyToStatusId
                    );
                }
            } catch (error) {
                elizaLogger.error("Error fetching parent tweet:", {
                    tweetId: currentTweet.inReplyToStatusId,
                    error,
                });
            }
        } else {
            elizaLogger.debug(
                "Reached end of reply chain at:",
                currentTweet.id
            );
        }
    }

    await processThread(tweet, 0);

    elizaLogger.debug("Final thread built:", {
        totalTweets: thread.length,
        tweetIds: thread.map((t) => ({
            id: t.id,
            text: t.text?.slice(0, 50),
        })),
    });

    return thread;
}