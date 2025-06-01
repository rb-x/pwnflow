FROM alpine:latest AS builder

ENV OWNER=rb-x
ENV REPO=penflow
ENV API_URL="https://api.github.com/repos/$OWNER/$REPO/releases/latest"

WORKDIR /root
RUN apk update && apk add --no-cache curl jq unzip
RUN LATEST_RELEASE=$(curl -s "$API_URL" | jq -r '.tag_name') && \
    curl -LO "https://github.com/$OWNER/$REPO/releases/download/$LATEST_RELEASE/penflow-free-$LATEST_RELEASE.zip" && \
    unzip -q "penflow-free-$LATEST_RELEASE.zip"

# serve site with nginx
FROM nginx:alpine

# copy files
WORKDIR /home/webserver
COPY ./nginx.conf /etc/nginx/
COPY --from=builder /root/dist /home/webserver/penflow

# expose and run
EXPOSE 80
