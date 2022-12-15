# jar-puppeteer-logger

Containerized app for Jar to login with various end points like NGA bbs

## Build and test in locally

### Local

```bash
npm run dev
```

### In Docker

1. Build local Docker image

   ```bash
   docker build -t jar .
   ```

1. Run container

   ```bash
   docker run -i --init --rm -p 3000:3000 --name jar-container jar
   ```

## Use

```
http://localhost:3000/?url=https://facebook.com
```

```
http://localhost:3000/?url=https://www.chiphell.com/member.php?mod=logging&action=login
```

## Deployment

```bash
pm2 install typescript

pm2 start --interpreter ts-node-dev src/server.ts
```

## Reference

https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/
