# Notes

```sh
docker compose up --build
curl "http://localhost:4001/screenshot?url=https://example.com" --output site.png
```

[Dockerfile](Dockerfile)
[docker-compose.yaml](docker-compose.yaml)


# Load test and  Scaling

[loadtest.js](loadtest.js) results:

1.5GB memory/3 CPU/1GB shm/5 Concurrency: 72 Requests/30s
700M memory/1 CPU/1GB shm/2 Concurrency: 24 Requests/30s

```sh
shm_size: "1gb"
deploy:
  resources:
    limits:
      memory: 700M
          cpus: "1.0"
```