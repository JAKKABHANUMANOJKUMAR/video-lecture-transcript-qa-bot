# Video Lecture Transcript Q&A Bot

## Project Overview

This project builds a Retrieval-Augmented Generation (RAG) based Q&A system for lecture videos. It uses OpenAI Whisper for automatic transcription, processes transcripts with timestamp preservation, and enables natural language queries with accurate answers and video timestamps.

## Problem Statement

Students struggle to find specific information in long lecture videos without rewatching entire content. Traditional search methods don't work well with unstructured video data, making it time-consuming to locate answers.

## Solution Approach

We implement an end-to-end RAG pipeline that:
- Transcribes lecture videos using OpenAI Whisper
- Chunks transcripts while preserving timestamps
- Generates embeddings for semantic search
- Stores data in a vector database
- Provides natural language Q&A with timestamp citations

## System Architecture

The system consists of:
1. **Transcription Module**: Audio-to-text conversion with Whisper
2. **Preprocessing Pipeline**: Transcript chunking and cleaning
3. **Embedding Service**: Vector generation for semantic search
4. **Vector Database**: Storage and retrieval of embedded chunks
5. **Q&A Engine**: RAG-based answer generation
6. **API Layer**: RESTful endpoints for queries
7. **Frontend Interface**: User-friendly web application

## Components / Services Description

- **Transcription Service**: Handles video upload and Whisper processing
- **Data Processing**: Cleans and chunks transcripts with metadata
- **Embedding Generator**: Creates vector representations
- **Vector Store Manager**: Manages FAISS/ChromaDB storage
- **Query Processor**: Handles user questions and retrieval
- **Answer Generator**: Uses LLM to synthesize responses
- **Timestamp Extractor**: Maps answers to video locations

## Tech Stack

- **Backend**: Python, FastAPI
- **AI/ML**: OpenAI Whisper, LangChain, OpenAI GPT
- **Vector DB**: FAISS or ChromaDB
- **Frontend**: React.js (optional)
- **Deployment**: Docker, AWS/GCP
- **Version Control**: Git, GitHub

## Folder Structure

```
video-lecture-transcript-qa-bot/
├── data/                 # Raw data storage (audio files, transcripts)
├── src/                  # Main application source code
├── embeddings/           # Generated embedding files
├── vector_store/         # Vector database storage
├── api/                  # API endpoints and backend logic
├── frontend/             # Web interface components
├── utils/                # Utility functions and helpers
├── configs/              # Configuration files and settings
├── notebooks/            # Jupyter notebooks for experimentation
└── tests/                # Unit and integration tests
```

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/JAKKABHANUMANOJKUMAR/video-lecture-transcript-qa-bot.git
   cd video-lecture-transcript-qa-bot
   ```

2. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   cp configs/.env.example configs/.env
   # Edit .env with your API keys
   ```

5. Download required models:
   ```bash
   python -m spacy download en_core_web_sm
   ```

## How to Run the Project

1. Start the transcription service:
   ```bash
   python src/transcription_service.py
   ```

2. Process a video:
   ```bash
   python src/process_video.py --input data/sample_video.mp4
   ```

3. Run the Q&A API:
   ```bash
   uvicorn api.main:app --reload
   ```

4. Access the web interface at `http://localhost:8000`

## Development Workflow

1. Create a feature branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "Add: brief description"
   ```

3. Push and create pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Code review and merge to `dev`, then to `main`

## Future Enhancements

- Multi-language support
- Video summarization
- Integration with learning management systems
- Real-time transcription for live lectures
- Advanced search filters
- User authentication and personalization

## Contribution Guidelines

1. Follow PEP 8 style guidelines
2. Write tests for new features
3. Update documentation
4. Use meaningful commit messages
5. Create issues for bugs and features
6. Request code review before merging