import { elizaLogger, type IAgentRuntime, type Memory, type Provider, type State } from "@elizaos/core";
import RedditService from "../services/redditService";

const redditProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        
        const rs = RedditService.getInstance(_runtime);
        rs.getHotPosts().then((posts) => {
            posts.forEach((post) => {
                elizaLogger.info(`Title: ${post.title}`);
                elizaLogger.info(`Content: ${post.selftext}`);
            });
        });


        return `The current date and time is. Please use this as your reference for any time-based operations or responses.`;
    },
};
export { redditProvider };
