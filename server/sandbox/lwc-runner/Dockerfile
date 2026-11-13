# Throwaway sandbox that grades one LWC submission per container run.
# Run with: --network none --read-only --memory 256m --cpus 0.5 --pids-limit 64
# --cap-drop ALL --security-opt no-new-privileges --user node (see lwcGrader.ts).
FROM node:22-alpine
WORKDIR /runner
RUN npm install --no-audit --no-fund --omit=dev jsdom@26.1.0 && npm cache clean --force
COPY runner.mjs ./
USER node
ENTRYPOINT ["node", "/runner/runner.mjs"]
