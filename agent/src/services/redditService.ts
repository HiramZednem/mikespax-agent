import snoowrap from 'snoowrap';
import { IAgentRuntime } from '@elizaos/core';

class RedditService {
    private static instance: RedditService;
    private client: snoowrap;
    private runtime: IAgentRuntime;

    

    private constructor(_runtime: IAgentRuntime) {
        const REDDIT_USERNAME  = _runtime.getSetting("REDDIT_USERNAME")   
        const REDDIT_CLIENT_ID = _runtime.getSetting("REDDIT_CLIENT_ID");
        const REDDIT_CLIENT_SECRET = _runtime.getSetting("REDDIT_CLIENT_SECRET");
        const REDDIT_PASSWORD = _runtime.getSetting("REDDIT_PASSWORD");
        const REDDIT_USER_AGENT = _runtime.getSetting("REDDIT_USER_AGENT");


        if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_PASSWORD || !REDDIT_USER_AGENT || !REDDIT_USERNAME) {
            throw new Error('Reddit credentials are missing. Please check your environment variables.');
        }

        this.client = new snoowrap({
            userAgent: REDDIT_USER_AGENT,
            clientId: REDDIT_CLIENT_ID,
            clientSecret: REDDIT_CLIENT_SECRET,
            username: REDDIT_USERNAME,
            password: REDDIT_PASSWORD
        });
        this.runtime = _runtime;
    }

    public static getInstance(_runtime: IAgentRuntime): RedditService {
        if (!RedditService.instance) {
            RedditService.instance = new RedditService(_runtime);
        }
        return RedditService.instance;
    }

    async getHotPosts(): Promise<snoowrap.Submission[]> {
        try {
            return await this.client.getHot();
        } catch (error) {
            console.error('Error fetching hot posts:', error);
            throw error;
        }
    }

    async getSubredditPosts(subreddit: string): Promise<snoowrap.Submission[]> {
        try {
            return await this.client.getSubreddit(subreddit).getHot();
        } catch (error) {
            console.error(`Error fetching hot posts from ${subreddit}:`, error);
            throw error;
        }
    }

}

export default RedditService;