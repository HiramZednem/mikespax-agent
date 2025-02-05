import { elizaLogger, type IAgentRuntime, type Memory, type Provider, type State } from "@elizaos/core";
import RedditService from "../services/redditService";

const redditProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        
        const rs = RedditService.getInstance(_runtime);


        const posts = await rs.getSubredditPosts('linux4noobs');

        // Shuffle the posts array to randomize the selection.
        // This ensures that we use a diverse set of posts while limiting the number of inputs to the AI model, optimizing for cost efficiency.
        for (let i = posts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [posts[i], posts[j]] = [posts[j], posts[i]];
        }

        let postsContent = '';

        posts.slice(0, 3).forEach((post) => {
            postsContent += `Title: ${post.title}\nContent: ${post.selftext}\n\n`;
        });

        const prompt = `
        # Context
        *** You will be provided with multiple recent posts from a subreddit.

        # Task
        1. Relates to the extracted posts by identifying common themes, trends, or discussions.
        2. Matches the tone and style of the target subreddit.
        3. Is engaging and discussion-worthy, encouraging user participation.
        4. Ends with an open-ended question or statement to spark conversation.
        5. Speaks from the perspective of ${_runtime.character.name}, making it feel natural and authentic.

        # List of Extracted Posts:
        ${postsContent}`;


        return prompt;
    },
};
export { redditProvider };
