# BRDR RAG Application

A comprehensive RAG (Retrieval Augmented Generation) application for Banking Returns Data Repository (BRDR) documents, built with Next.js, TypeScript, Supabase, and AI SDK.

## 🚀 Features

- **Hybrid ETL Pipeline**: Combines BRDR API metadata with markdown file content
- **Page-Based Chunking**: Intelligent document chunking by pages for better context
- **Vector Search**: Semantic search using Xenova/all-MiniLM-L6-v2 embeddings (384D)
- **Smart Document Matching**: Automatically matches API documents with markdown files
- **Hybrid Search**: Combines vector and keyword search strategies
- **Real-time Chat Interface**: AI-powered chatbot with tool calling
- **Audit Trail**: Comprehensive logging and performance tracking
- **Gemini/Qwen LLM Support**: Compatible with multiple AI models
- **Fallback Handling**: Graceful handling of documents without markdown files

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Node.js
- **Database**: Supabase with pgvector extension
- **AI/ML**: AI SDK, Xenova Transformers, Google Gemini
- **Vector Search**: pgvector with HNSW indexing
- **Embeddings**: Xenova/all-MiniLM-L6-v2 (384 dimensions)

## 📋 Prerequisites

- Node.js 18+ 
- Supabase account and project
- Google AI Studio API key (for Gemini) or OpenAI API key

## ⚙️ Setup Instructions

### 1. Environment Variables

Copy the example environment file and configure your variables:

```bash
cp env.example .env.local
```

Update `.env.local` with your actual values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google AI Studio API Key for Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key

# Alternative: OpenAI API Key (for Qwen models)
OPENAI_API_KEY=your_openai_api_key

# Other configurations (optional)
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Set up your Supabase database with the required tables and extensions:

```bash
npm run db:setup
```

This will:
- Enable pgvector and uuid-ossp extensions
- Create `brdr_documents` and `brdr_documents_data` tables
- Set up vector search functions
- Create necessary indexes

### 4. Run ETL Pipeline

Populate your database with BRDR documents:

```bash
# Run the full ETL pipeline (crawl + process + embed + store)
npm run etl:full

# Or run individual steps:
npm run etl:crawl    # Just crawl documents
npm run etl:process  # Process and store documents
```

### 5. Test RAG System

Verify your RAG setup is working:

```bash
npm run test:rag
```

### 6. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the chat interface.

## 📖 Usage

### Chat Interface

1. Open the application in your browser
2. Type your question about BRDR documents
3. The AI will search relevant documents and provide contextual answers
4. View audit trail and performance metrics

### Sample Queries

- "What are the banking regulations for data submission?"
- "Tell me about BRDR requirements"
- "How do I submit regulatory returns?"
- "What are the compliance guidelines?"

### Search Strategies

- **Vector Search**: Semantic similarity using embeddings
- **Keyword Search**: Traditional text-based search
- **Hybrid Search**: Combines both approaches with ranking

## 🏗️ Architecture

### ETL Pipeline

```
BRDR API → Crawler → Hierarchical Chunker → Embedding Service → Supabase
```

1. **Crawler**: Fetches documents from BRDR API
2. **Chunker**: Creates hierarchical chunks (document → section → paragraph → sentence)
3. **Embeddings**: Generates 384-dimensional vectors using Xenova model
4. **Storage**: Stores in Supabase with vector indexing

### RAG System

```
User Query → Embedding → Vector Search → Context Formation → LLM → Response
```

1. **Query Analysis**: Extracts intent and entities
2. **Embedding**: Converts query to vector representation
3. **Retrieval**: Searches relevant document chunks
4. **Generation**: Uses Gemini/Qwen to generate contextual response

## 📊 Database Schema

### brdr_documents
- Core document metadata
- Full document embeddings
- BRDR-specific fields (topics, concepts, etc.)

### brdr_documents_data
- Document chunks with embeddings
- Hierarchical relationships
- Vector search optimization

## 🔧 Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:setup` | Initialize database |
| `npm run etl:crawl` | Crawl BRDR documents |
| `npm run etl:process` | Process and embed documents |
| `npm run etl:full` | Run complete ETL pipeline |
| `npm run test:rag` | Test RAG functionality |

## 📈 Performance

### Optimizations

- **HNSW Vector Indexing**: Fast approximate nearest neighbor search
- **Hierarchical Chunking**: Better context preservation
- **Caching**: Query result caching
- **Batch Processing**: Efficient embedding generation
- **Connection Pooling**: Database optimization

### Metrics

- Query processing: ~200-500ms
- Embedding generation: ~50-100ms per chunk
- Vector search: ~10-50ms
- Document retrieval: 5-20 documents per query

## 🛡️ Security

- Row Level Security (RLS) ready
- Service role key for backend operations
- Secure API endpoints
- Input validation and sanitization

## 🔍 Monitoring

### Audit Trail
- Query logging
- Performance metrics
- Error tracking
- Session management

### Available Endpoints
- `/api/chat` - Chat interface
- `/api/audit-trail` - Audit logs
- `/audit-trail` - Audit dashboard

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check Supabase URL and keys
   - Verify pgvector extension is enabled
   - Run `npm run db:setup`

2. **Embedding Service Error**
   - Ensure sufficient memory (2GB+ recommended)
   - Check Node.js version (18+)
   - Clear node_modules and reinstall

3. **No Documents Found**
   - Run ETL pipeline: `npm run etl:full`
   - Check BRDR API connectivity
   - Verify database tables exist

4. **Slow Performance**
   - Check vector indexes are created
   - Reduce chunk size or query limit
   - Monitor memory usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Related Links

- [Supabase Documentation](https://supabase.com/docs)
- [AI SDK Documentation](https://sdk.vercel.ai)
- [Xenova Transformers](https://huggingface.co/docs/transformers.js)
- [BRDR API](https://brdr.hkma.gov.hk)

## 📞 Support

For questions or issues:
1. Check the troubleshooting section
2. Review the logs in audit trail
3. Run test scripts to diagnose issues
4. Open an issue with detailed logs

---

Built with ❤️ using Next.js, Supabase, and AI SDK