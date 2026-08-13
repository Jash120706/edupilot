#!/bin/bash

set -e

DOCKER_USERNAME="jk120706"
IMAGE_NAME="edupilot-client"
CONTAINER_NAME="edupilot-client"

echo "================================="
echo "Building EduPilot frontend image"
echo "================================="

docker build -t ${IMAGE_NAME}:latest ./client

echo "Stopping old container..."

docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true

echo "Starting new container..."

docker run -d \
  --name ${CONTAINER_NAME} \
  -p 80:80 \
  ${IMAGE_NAME}:latest

echo "Tagging image..."

docker tag ${IMAGE_NAME}:latest \
  ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo "Pushing image to Docker Hub..."

docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo "================================="
echo "EduPilot frontend deployment completed!"
echo "================================="
