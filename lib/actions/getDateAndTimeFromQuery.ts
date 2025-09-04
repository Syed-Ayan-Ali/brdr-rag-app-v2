import { logger, LogCategory } from '../logging/Logger';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export const getDateAndTimeFromQuery = async (query: string, limit: number = 10) => {

    // given a query, use an llm to extract the date and time

    const result = await generateText({
        model: google('gemini-2.0-flash'),
        prompt: `Extract the date and time from the following query: ${query}`,
    });

    console.log("result from getDateAndTimeFromQuery is", result);
    
    return result;      
  }
