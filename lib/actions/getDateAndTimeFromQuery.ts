import { generateText } from 'ai';
import { myProvider } from '../ai/providers';

export const getDateAndTimeFromQuery = async (query: string, limit: number = 10) => {

    // given a query use an llm to extract the year, month and day from the query
    const result = await generateText({
        model: myProvider.languageModel('azure-sm-model'),
        prompt: `Extract the start year, start month, start day, end year, end month and end day from the following query: ${query} in the format of {start_year: number, start_month: number, start_day: number, end_year: number, end_month: number, end_day: number}`,
    });

    console.log("result from getDateAndTimeFromQuery is", result);

    return result;
    
  }
