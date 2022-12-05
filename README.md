# jar-puppeteer-logger

Containerized app for Jar to login with various end points like NGA bbs

## Build and test in locally

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
