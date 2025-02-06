import { elizaLogger, type IAgentRuntime, type Memory, type Provider, type State } from "@elizaos/core";
import RedditService from "../services/redditService";

const redditProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        
        const rs = RedditService.getInstance(_runtime);


        /**
         * In case that you want to add specific subreddits for each agent, you can add them in this way
         * 
         * if (_runtime.character.name === 'Agent1') {
         *     const subreddits = ['Hasan_Piker', 'Palestine', 'worldnews']
         * } else if (_runtime.character.name === 'Agent2') {
         *    const subreddits = ['Hasan_Piker', 'Palestine', 'worldnews']
         * } else { // always put else clause to avoid any runtime error
         *   const subreddits = ['Hasan_Piker', 'Palest ine', 'worldnews']
         * }
         * 
         * And if you want to add more subreddits, you can add them in the subreddits array
         * ['Hasan_Piker', 'Palestine', 'worldnews', 'subreddit1', 'subreddit2', 'subreddit3'......]
         */
        const subreddits = ['Hasan_Piker', 'Palestine', 'worldnews']

        let postsContent = '';

        for (const subreddit of subreddits) {
            let posts = await rs.getSubredditPosts(subreddit);
            // Shuffle the posts array to randomize the selection.
            // This ensures that we use a diverse set of posts while limiting the number of inputs to the AI model, optimizing for cost efficiency.
            for (let i = posts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [posts[i], posts[j]] = [posts[j], posts[i]];
            }

            posts.slice(0, 3).forEach((post) => {
                postsContent += `Title: ${post.title}\nContent: ${post.selftext}\n\n`;
            });
        }


        const prompt = `
        # Context
        You are provided with multiple recent posts from a subreddit. Use this information to respond or engage with the audience effectively.

        # Task
        1. Identify common themes, trends, or discussions from the extracted posts.
        2. Match the tone and style of the target subreddit.
        3. Create engaging and discussion-worthy content that encourages user participation.
        4. Speak from the perspective of ${_runtime.character.name} to make it feel natural and authentic.

        # Extracted Posts:
        ${postsContent}`;


        return prompt;
    },
};
export { redditProvider };
