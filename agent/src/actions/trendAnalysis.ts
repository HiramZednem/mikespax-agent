import { Action, elizaLogger, IAgentRuntime, Memory, State, composeContext, generateText, cleanJsonResponse, parseJSONObjectFromText, extractAttributes, truncateToCompleteSentence, ModelClass, HandlerCallback, Content } from "@elizaos/core";



const tweetTemplate = `
You are {{character}}, an expert in stock market analysis, providing a casual, conversational overview of the market trends. Focus on these tickers: {tickers_list}

Key points to cover:    
1. Top themes in the stock market today
2. Most relevant tickers and their significance
3. Major themes based on recent news and events

Format your response like this:    
First line: Only the cashtags of the tickers mentioned (e.g., $NVDA $TSLA)
Two empty lines
Then your analysis in your unique voice, using natural breaks between thoughts
Keep it under 1500 characters

Remember:    
- No formal headers or bullet points
- Write as if you're casually chatting with a friend about the market
- Use your character's unique style and expressions throughout
- Make it engaging and easy to read in a tweet format
`;


export const trendAnalysisAction: Action = {
    name: "TREND_ANALYSIS",
    similes: ["TICKER_ANALYSIS", "TICKER_REVIEW"],
    description: "Make a analysis",
    suppressInitialMessage: true,
    validate: async ( runtime: IAgentRuntime, _message: Memory ) => {
        return true;
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
            elizaLogger.info("Generating an analysis...");

            // 1. GET THE TICKER FROM THE TEXT
            const context: string = `
            Extract the ticker symbol from the following message by {{username}}:
            "${message.content.text}"
            
            Only respond with the ticker symbol (e.g., AAPL), and do not include any other text.`;

            const response = await generateText({
                runtime: runtime,
                context,
                modelClass: ModelClass.SMALL,
            });
        

            const content = `The ticker which you want the analysis is: ${response}`


            // 2. MAKE AN API CALL
            
            
            // 3. CREATE THE ANALYSIS
            
            
            // 4. REPLY
            callback({ text: content })
            
        } catch (error) {
            elizaLogger.error("Error in post action:", error);
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "@{{TWITTER_USERNAME}} $NVDA" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me create an analysis for you",
                    action: "TREND_ANALYSIS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "@{{TWITTER_USERNAME}} $AAPL" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me create an analysis for you",
                    action: "TREND_ANALYSIS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "@{{TWITTER_USERNAME}} $TSLA" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Let me create an analysis for you",
                    action: "TREND_ANALYSIS",
                },
            },
        ]
    ],
};