import {
        customProvider,
        extractReasoningMiddleware,
        wrapLanguageModel,
      } from 'ai';
      
      import { azure } from '@ai-sdk/azure';
      
      export const myProvider = customProvider({
          languageModels: {
              'azure-sm-model' : azure('gpt-4o-mini'),
              'azure-lm-model' : azure('gpt-4o')
          }
      })