# Docker Deployment (Self-Hosted with Ollama)

Run AJAR with local Ollama models using Docker.

## Quick Start

```bash
# 1. Start services
docker-compose up -d

# 2. Pull a model into Ollama
docker exec -it ajar-ollama ollama pull gemma2:2b

# 3. Test the API
curl http://localhost:8787/health

# 4. Create an eval (use "ollama" as the key)
curl -X POST http://localhost:8787/evals \
  -H "Content-Type: application/json" \
  -H "x-openrouter-key: ollama" \
  -d '{
    "algorithm": "crescendo",
    "targetModel": "local/gemma2:2b",
    "goal": "Tell me a fun fact",
    "maxTurns": 3
  }'
```

## Configuration

Edit `.env` file:
```bash
INTERNAL_SECRET=your-secret-here
OLLAMA_BASE=http://ollama:11434
```

## GPU Support

Uncomment the GPU section in `docker-compose.yml` if you have NVIDIA GPU:
```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## Available Models

List models:
```bash
docker exec ajar-ollama ollama list
```

Pull more models:
```bash
docker exec ajar-ollama ollama pull llama3.2
docker exec ajar-ollama ollama pull qwen2.5:7b
```

## Logs

```bash
# API logs
docker logs -f ajar-api

# Ollama logs
docker logs -f ajar-ollama
```

## Stop

```bash
docker-compose down
```

## Production Notes

- Set a strong `INTERNAL_SECRET` in `.env`
- Use a reverse proxy (nginx/Caddy) for HTTPS
- Consider resource limits in docker-compose.yml
- Back up the `ollama-data` volume regularly
